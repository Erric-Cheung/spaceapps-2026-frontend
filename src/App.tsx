import { useState } from "react";
import Map from "./components/Map.tsx";
import FieldDataForm from "./components/FieldDataForm.tsx";
import LocationStep from "./components/LocationStep.tsx";
import SelectedFields from "./components/SelectedFields.tsx";
import FieldSelectionPanel from "./components/FieldSelectionPanel.tsx";
import type { FieldFeature } from "./data/fields";
import type { GeoLocation } from "./data/geocode";
import { fetchCropHistory } from "./data/cropHistory";

type Step = "location" | "fields" | "form";

function App() {
  const [step, setStep] = useState<Step>("location");
  const [location, setLocation] = useState<GeoLocation | null>(null);
  const [selectedFields, setSelectedFields] = useState<FieldFeature[]>([]);
  const [isLoadingPredictions, setIsLoadingPredictions] = useState(false);
  const [predictionsError, setPredictionsError] = useState<string | null>(null);

  const handleLocationSelected = (next: GeoLocation) => {
    setLocation(next);
    setSelectedFields([]);
    setStep("fields");
  };

  const selectedCount = selectedFields.length;

  const requestPredictions = async () => {
    if (selectedCount === 0) return;
    setIsLoadingPredictions(true);
    setPredictionsError(null);
    try {
      await fetchCropHistory(selectedFields.map(field => field.properties.id));
      setStep("form");
    } catch {
      setPredictionsError("Could not load field history. Please try again.");
    } finally {
      setIsLoadingPredictions(false);
    }
  };

  return (
    <>
      <header>
        <div className="header-brand">
          <h1>Money Stealer</h1>
        </div>
      </header>

      {step === "location" && <LocationStep onLocated={handleLocationSelected} />}

      {step !== "location" && location && (
        <main className="field-workspace">
          <Map
            key={`${location.lat},${location.lng}`}
            location={location}
            onChange={setSelectedFields}
          />
          <aside className={`field-panel${step === "form" ? " field-panel-details" : ""}`} aria-label={step === "form" ? "Field details" : "Field selection"}>
            {step === "fields" ? (
              <>
                <FieldSelectionPanel
                  selectedCount={selectedCount}
                  isLoadingPredictions={isLoadingPredictions}
                  error={predictionsError}
                  onPredict={requestPredictions}
                />
                <SelectedFields fields={selectedFields} />
              </>
            ) : (
              <FieldDataForm fields={selectedFields} onClose={() => setStep("fields")} />
            )}
          </aside>
        </main>
      )}
    </>
  );
}

export default App;
