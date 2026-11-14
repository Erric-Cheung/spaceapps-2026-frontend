import { useState } from "react";
import Map from "./components/Map.tsx";
import FieldDataForm from "./components/FieldDataForm.tsx";
import LocationStep from "./components/LocationStep.tsx";
import type { FieldFeature } from "./data/fields";
import type { GeoLocation } from "./data/geocode";

type Stage = "location" | "fields" | "form";

function App() {
  const [stage, setStage] = useState<Stage>("location");
  const [location, setLocation] = useState<GeoLocation | null>(null);
  const [selectedFields, setSelectedFields] = useState<FieldFeature[]>([]);

  const onLocated = (next: GeoLocation) => {
    setLocation(next);
    setSelectedFields([]);
    setStage("fields");
  };

  const count = selectedFields.length;

  return (
    <>
      <header>
        <div className="header-brand">
          <h1>Money Stealer</h1>
        </div>
      </header>

      {stage === "location" && <LocationStep onLocated={onLocated} />}

      {stage === "fields" && location && (
        <Map
          key={`${location.lat},${location.lng}`}
          location={location}
          onChange={setSelectedFields}
        >
          <div className="map-panel">
            <h3>Select your fields</h3>
            <ol>
              <li>Drag the map to move around.</li>
              <li>Click a field to select it.</li>
              <li>Shift-drag to select several fields at once.</li>
              <li>When you have all your fields, click Continue.</li>
            </ol>
            <button
              type="button"
              disabled={count === 0}
              onClick={() => setStage("form")}
            >
              {count === 0
                ? "Select at least one field"
                : `Continue with ${count} field${count === 1 ? "" : "s"}`}
            </button>
          </div>
        </Map>
      )}

      {stage === "form" && <FieldDataForm fields={selectedFields} />}
    </>
  );
}

export default App;
