import { lazy, Suspense, useMemo, useRef, useState } from "react";
import FieldReviewForm from "./components/FieldReviewForm.tsx";
import LocationStep from "./components/LocationStep.tsx";
import FieldSelectionPanel from "./components/FieldSelectionPanel.tsx";
import type { FieldFeature } from "./data/fields";
import type { GeoLocation } from "./data/geocode";
import type { CropHistoryResponse } from "./data/cropHistory";
import { useCropHistory } from "./data/cropHistoryCache";
import type { FieldMapHandle } from "./components/Map";
import type { FieldReviewInput } from "./data/fieldReview";

type Step = "location" | "fields" | "form";
const Map = lazy(() => import("./components/Map.tsx"));

function App() {
  const [step, setStep] = useState<Step>("location");
  const [location, setLocation] = useState<GeoLocation | null>(null);
  const [selectedFields, setSelectedFields] = useState<FieldFeature[]>([]);
  const mapRef = useRef<FieldMapHandle>(null);
  const [reviewInputs, setReviewInputs] = useState<Record<string, FieldReviewInput>>({});
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

  const handleLocationSelected = (next: GeoLocation) => {
    setLocation(next);
    setSelectedFields([]);
    setReviewInputs({});
    setStep("fields");
  };

  return (
    <>
      <header className={step === "location" ? "landing-header" : undefined}>
        <div className="header-brand">
          <h1>Money Stealer</h1>
        </div>
      </header>

      {step === "location" && <LocationStep onLocated={handleLocationSelected} />}

      {step !== "location" && location && (
        <main className={`field-workspace${step === "form" ? " field-workspace--form" : ""}`}>
          <Suspense fallback={<div className="map-loading" role="status">Opening your field map…</div>}>
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
                onRemove={id => mapRef.current?.removeField(id)}
                onHighlight={highlightField}
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
              />
            )}
          </aside>
        </main>
      )}
    </>
  );
}

export default App;
