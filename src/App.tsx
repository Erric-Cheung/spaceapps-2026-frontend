import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Info, MessageCircle } from "lucide-react";
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
import { cropAnswer, NO_CROP, UNKNOWN_CROP, type FieldReviewInput } from "./data/fieldReview";
import type { ChatContext } from "./data/chat";
import type { SubmittedField } from "./data/cropPlanning";

type Step = "location" | "fields" | "form" | "results";
const Map = lazy(() => import("./components/Map.tsx"));
const AssistantPanel = lazy(() => import("./components/AssistantPanel.tsx"));
const STEP_TITLES: Record<Step, string> = {
  location: "Find your fields",
  fields: "Choose your fields",
  form: "Confirm your crops",
  results: "Compare rotations",
};

function App() {
  const [step, setStep] = useState<Step>("location");
  const [showAbout, setShowAbout] = useState(false);
  const [location, setLocation] = useState<GeoLocation | null>(null);
  const [selectedFields, setSelectedFields] = useState<FieldFeature[]>([]);
  const mapRef = useRef<FieldMapHandle>(null);
  const [reviewInputs, setReviewInputs] = useState<Record<string, FieldReviewInput>>({});
  const [submittedFields, setSubmittedFields] = useState<SubmittedField[]>([]);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [assistantOpen, setAssistantOpen] = useState(false);
  // Mounted on first open and kept, so the conversation survives closing the panel.
  const [assistantLoaded, setAssistantLoaded] = useState(false);
  // On every change of view, name the page and move focus to the new view's heading,
  // so keyboard and screen reader users are not left on a control that no longer exists.
  const shownView = useRef(`${step}|${showAbout}`);
  useEffect(() => {
    document.title = `${showAbout ? "About" : STEP_TITLES[step]} · AGI crop rotation planner`;
    const view = `${step}|${showAbout}`;
    if (shownView.current === view) return;
    shownView.current = view;
    const heading = [...document.querySelectorAll<HTMLElement>("[data-step-title]")].find(el => el.offsetParent !== null);
    heading?.focus();
  }, [step, showAbout]);
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
  const assistant = useMemo(
    () => assistantContext(selectedFields, reviewInputs, location),
    [selectedFields, reviewInputs, location],
  );

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
          <h1 className="header-copy">
            <span className="header-title">AGI</span>
            <span className="header-subtitle">Agricultural General Intelligence</span>
          </h1>
        </div>
        <div className="header-actions">
        <button
          type="button"
          className="button-secondary header-ask"
          aria-haspopup="dialog"
          aria-label="Ask a question"
          onClick={() => { setAssistantLoaded(true); setAssistantOpen(true); }}
        >
          <MessageCircle size={18} aria-hidden="true" />
          <span className="header-ask-label">Ask a question</span>
        </button>
        <button
          type="button"
          className="button-secondary header-about"
          aria-label={showAbout ? "Back to app" : "About"}
          onClick={() => setShowAbout(value => !value)}
        >
          {showAbout ? <ArrowLeft size={18} aria-hidden="true" /> : <Info size={18} aria-hidden="true" />}
          <span className="header-about-label">{showAbout ? "Back to app" : "About"}</span>
        </button>
        </div>
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
          <section className="field-panel" aria-label={step === "form" ? "Crop confirmation" : "Field selection"}>
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
          </section>
        </main>
        )}
      </div>

      {showAbout && <AboutStep />}

      {assistantLoaded && (
        <Suspense fallback={null}>
          <AssistantPanel
            open={assistantOpen}
            onClose={() => setAssistantOpen(false)}
            {...assistant}
          />
        </Suspense>
      )}
    </>
  );
}

const fieldLabel = (field: FieldFeature, index: number) => `Field ${field.properties.selectionNumber ?? index + 1}`;

const listInWords = (items: string[]) => items.length <= 2 ? items.join(" and ")
  : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;

/**
 * What the assistant is told about the screen, a sentence saying so to the farmer, and
 * questions to start with. Only crops the farmer confirmed are sent as the current crop;
 * mapped estimates stay with the assistant's own crop history lookup.
 */
function assistantContext(
  fields: FieldFeature[],
  inputs: Record<string, FieldReviewInput>,
  location: GeoLocation | null,
) {
  const named = fields.map((field, index) => {
    const input = inputs[field.properties.id];
    const crop = input && input.crop && input.crop !== NO_CROP && input.crop !== UNKNOWN_CROP ? cropAnswer(input) : undefined;
    return { field, name: fieldLabel(field, index), crop };
  });
  const context: ChatContext = {
    provinceCode: "ON",
    location: location ? { lat: location.lat, lon: location.lng } : undefined,
    selectedFieldId: fields.length === 1 ? fields[0].properties.id : undefined,
    fields: named.length ? named.map(({ field, name, crop }) => ({
      fieldId: field.properties.id, name, currentCrop: crop, geometry: field.geometry,
    })) : undefined,
  };
  const place = location?.label?.split(",")[0];
  const shown = named.length > 6
    ? `${named.length} selected fields`
    : listInWords(named.map(({ name, crop }) => crop ? `${name} (${crop.toLowerCase()})` : name));
  const contextSummary = named.length
    ? `${shown}${place ? ` near ${place}` : ""}.`
    : location ? `the map location${place ? `, ${place}` : ""}. Select fields to ask about them.` : null;
  const first = named[0]?.name;
  const suggestions = first ? [
    `What can you tell me about ${first}?`,
    `What should I grow in ${first} next year?`,
    `How dry has it been around ${first} this season?`,
  ] : location ? [
    "What crops grow well around here?",
    "When do farmers here usually plant corn?",
    "What is crop rotation and why does it help?",
  ] : [
    "What is crop rotation and why does it help?",
    "What is a cover crop?",
    "What usually follows soybeans in Ontario?",
  ];
  const names = Object.fromEntries(named.map(({ field, name }) => [field.properties.id, name]));
  return { context, contextSummary, suggestions, fieldName: (id: string) => names[id] ?? "this field" };
}

export default App;
