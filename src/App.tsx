import { lazy, Suspense, useMemo, useRef, useState } from "react";
import { ArrowLeft, Info } from "lucide-react";
import { SkeletonBox } from "skullet/react";
import AboutStep from "./components/AboutStep.tsx";
import FieldReviewForm from "./components/FieldReviewForm.tsx";
import LocationStep from "./components/LocationStep.tsx";
import FieldSelectionPanel from "./components/FieldSelectionPanel.tsx";
import ResultsStep from "./components/ResultsStep.tsx";
import type { FieldFeature } from "./data/fields";
import type { GeoLocation } from "./data/geocode";
import type { CropHistoryResponse } from "./data/cropHistory";
import { useCropHistory } from "./data/cropHistoryCache";
import type { FieldMapHandle } from "./components/Map";
import type { FieldReviewInput } from "./data/fieldReview";
import type { SubmittedField } from "./data/cropPlanning";

type Step = "location" | "fields" | "form" | "results";
const Map = lazy(() => import("./components/Map.tsx"));

function App() {
  const [step, setStep] = useState<Step>("location");
  const [showAbout, setShowAbout] = useState(false);
  const [location, setLocation] = useState<GeoLocation | null>(null);
  const [selectedFields, setSelectedFields] = useState<FieldFeature[]>([]);
  const mapRef = useRef<FieldMapHandle>(null);
  const [reviewInputs, setReviewInputs] = useState<Record<string, FieldReviewInput>>({});
  const [submittedFields, setSubmittedFields] = useState<SubmittedField[]>([]);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const selectedIds = useMemo(() => selectedFields.map(field => field.properties.id), [selectedFields]);
  const { entries, retry } = useCropHistory(selectedIds);
  const failedHistory = selectedIds.filter(id => entries[id]?.status === 'error').length;
  const historyResults = selectedIds.flatMap(id => entries[id]?.result ? [entries[id].result!] : []);
  const cropHistory: CropHistoryResponse = {
    results: historyResults,
    requested: selectedIds.length,
    succeeded: selectedIds.filter(id => entries[id]?.status === 'ready').length,
    failed: failedHistory,
  };
  const highlightField = (id: string | null) => {
    setHighlightedId(id);
    mapRef.current?.highlightField(id);
  };

  const removeField = (id: string) => {
    setSelectedFields(previous => previous
      .filter(field => field.properties.id !== id)
      .map((field, index) => ({ ...field, properties: { ...field.properties, selectionNumber: index + 1 } })));
    mapRef.current?.removeField(id);
  };

  const handleLocationSelected = (next: GeoLocation) => {
    setLocation(next);
    setSelectedFields([]);
    setReviewInputs({});
    setSubmittedFields([]);
    setStep("fields");
  };

  const startOver = () => {
    setLocation(null);
    setSelectedFields([]);
    setReviewInputs({});
    setSubmittedFields([]);
    setStep("location");
  };

  return (
    <>
      <header className={step === "location" ? "landing-header" : undefined}>
        <div className="header-brand">
          <img className="header-icon" src="/logo.png" alt="" width={44} height={44} aria-hidden="true" />
          <span className="header-divider" aria-hidden="true" />
          <span className="header-copy">
            <span className="header-title">AGI</span>
            <span className="header-subtitle">Agricultural General Intelligence</span>
          </span>
        </div>
        <button
          type="button"
          className="button-secondary header-about"
          aria-label={showAbout ? "Back to app" : "About"}
          onClick={() => setShowAbout(value => !value)}
        >
          {showAbout ? <ArrowLeft size={18} aria-hidden="true" /> : <Info size={18} aria-hidden="true" />}
          <span className="header-about-label">{showAbout ? "Back to app" : "About"}</span>
        </button>
      </header>

      <div className={`app-view${showAbout ? " app-view--hidden" : ""}`}>
        {step === "location" && <LocationStep onLocated={handleLocationSelected} />}

        {step === "results" && (
          <ResultsStep
            fields={selectedFields}
            answers={submittedFields}
            mappedCrops={Object.fromEntries(selectedIds.map(id => {
              const summary = entries[id]?.result?.history?.summary;
              return [id, summary?.currentCrop?.crop ?? summary?.latestMapped?.groupLabel];
            }))}
            onBack={() => setStep("form")}
            onStartOver={startOver}
          />
        )}

        {step !== "location" && step !== "results" && location && (
        <main className={`field-workspace${step === "form" ? " field-workspace--form" : ""}`}>
          <Suspense fallback={<div className="field-map map-loading" role="status"><span className="sr-only">Opening your field map</span><SkeletonBox className="map-loading-box" width="100%" height="100%" radius={0} /></div>}>
            <Map
              ref={mapRef}
              onHoverField={setHighlightedId}
              key={`${location.lat},${location.lng}`}
              location={location}
              onChange={setSelectedFields}
            />
          </Suspense>
          <aside className="field-panel" aria-label={step === "form" ? "Field details" : "Field selection"}>
            {step === "fields" ? (
              <FieldSelectionPanel
                fields={selectedFields}
                highlightedId={highlightedId}
                onContinue={() => { highlightField(null); setStep("form"); }}
                onLocate={field => mapRef.current?.focusField(field)}
                onRemove={removeField}
                onHighlight={highlightField}
                onBack={startOver}
              />
            ) : (
              <FieldReviewForm
                fields={selectedFields}
                history={cropHistory}
                inputs={reviewInputs}
                onUpdate={(id, input) => setReviewInputs(previous => ({ ...previous, [id]: input }))}
                historyEntries={entries}
                onRetryHistory={retry}
                onClose={() => setStep("fields")}
                onSubmit={answers => { setSubmittedFields(answers); setStep("results"); }}
              />
            )}
          </aside>
        </main>
        )}
      </div>

      {showAbout && <AboutStep />}
    </>
  );
}

export default App;
