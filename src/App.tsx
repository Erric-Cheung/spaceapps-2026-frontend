import { useState } from "react";
import Map from "./components/Map.tsx";
import FieldDataForm from "./components/FieldDataForm.tsx";
import LocationStep from "./components/LocationStep.tsx";
import SelectedFields from "./components/SelectedFields.tsx";
import FieldSelectionPanel from "./components/FieldSelectionPanel.tsx";
import type { FieldFeature } from "./data/fields";
import type { GeoLocation } from "./data/geocode";
import { fetchCropHistory } from "./data/cropHistory";

type Stage = "location" | "fields" | "form";

function App() {
  const [stage, setStage] = useState<Stage>("location");
  const [location, setLocation] = useState<GeoLocation | null>(null);
  const [selectedFields, setSelectedFields] = useState<FieldFeature[]>([]);
  const [predicting, setPredicting] = useState(false);
  const [predictError, setPredictError] = useState<string | null>(null);

  const onLocated = (next: GeoLocation) => {
    setLocation(next);
    setSelectedFields([]);
    setStage("fields");
  };

  const count = selectedFields.length;

  const getPredictions = async () => {
    if (count === 0) return;
    setPredicting(true);
    setPredictError(null);
    try {
      await fetchCropHistory(selectedFields.map(field => field.properties.id));
      setStage("form");
    } catch {
      setPredictError("Could not load field history. Please try again.");
    } finally {
      setPredicting(false);
    }
  };

  return (
    <>
      <header>
        <div className="header-brand">
          <h1>Money Stealer</h1>
        </div>
      </header>

      {stage === "location" && <LocationStep onLocated={onLocated} />}

      {stage !== "location" && location && (
        <main className="field-workspace">
          <Map
            key={`${location.lat},${location.lng}`}
            location={location}
            onChange={setSelectedFields}
          />
          <aside className={`field-panel${stage === "form" ? " field-panel-details" : ""}`} aria-label={stage === "form" ? "Field details" : "Field selection"}>
            {stage === "fields" ? (
              <>
                <FieldSelectionPanel
                  count={count}
                  predicting={predicting}
                  error={predictError}
                  onPredict={getPredictions}
                />
                <SelectedFields fields={selectedFields} />
              </>
            ) : (
              <FieldDataForm fields={selectedFields} onClose={() => setStage("fields")} />
            )}
          </aside>
        </main>
      )}
    </>
  );
}

export default App;
