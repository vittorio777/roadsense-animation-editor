import { getAssetsByType } from "../../../assets/assetRegistry";
import { useEditorStore } from "../../../store/editorStore";

const backgroundAssets = getAssetsByType("background");
const vehicleAssets = getAssetsByType("vehicle");

export function ObjectLibraryPanel() {
  const selectedBackgroundId = useEditorStore(
    (state) => state.project.scene.background?.assetId,
  );
  const setSceneBackground = useEditorStore(
    (state) => state.setSceneBackground,
  );
  const vehicles = useEditorStore((state) => state.project.scene.objects);
  const addVehicle = useEditorStore((state) => state.addVehicle);

  return (
    <aside
      aria-labelledby="object-library-heading"
      className="flex min-h-0 flex-col border-r border-neutral-300 bg-neutral-50"
    >
      <div className="border-b border-neutral-300 px-4 py-3">
        <h2
          id="object-library-heading"
          className="text-sm font-semibold text-neutral-900"
        >
          Object Library
        </h2>
      </div>

      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-3">
        <section aria-labelledby="background-library-heading">
          <h3
            id="background-library-heading"
            className="mb-2 px-1 text-xs font-semibold uppercase text-neutral-500"
          >
            Backgrounds
          </h3>

          <div className="grid gap-2">
            {backgroundAssets.map((asset) => {
              const isSelected = selectedBackgroundId === asset.id;

              return (
                <button
                  key={asset.id}
                  type="button"
                  aria-pressed={isSelected}
                  data-asset-id={asset.id}
                  className={`w-full rounded border bg-white p-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 ${
                    isSelected
                      ? "border-emerald-700 ring-1 ring-emerald-700"
                      : "border-neutral-300 hover:border-neutral-500"
                  }`}
                  onClick={() => setSceneBackground(asset.id)}
                >
                  <img
                    src={asset.src}
                    alt=""
                    draggable={false}
                    className="aspect-video w-full rounded-sm border border-neutral-200 bg-neutral-100 object-cover"
                  />
                  <span className="mt-2 block min-w-0">
                    <span className="block truncate text-sm font-medium text-neutral-800">
                      {asset.name}
                    </span>
                    {isSelected ? (
                      <span className="mt-1 block text-xs font-medium text-emerald-800">
                        Selected
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section
          aria-labelledby="vehicle-library-heading"
          className="mt-4 border-t border-neutral-200 pt-3"
        >
          <h3
            id="vehicle-library-heading"
            className="mb-2 px-1 text-xs font-semibold uppercase text-neutral-500"
          >
            Vehicles
          </h3>

          <div className="grid gap-2">
            {vehicleAssets.map((asset) => {
              const instanceCount = vehicles.filter(
                (vehicle) => vehicle.assetId === asset.id,
              ).length;

              return (
                <button
                  key={asset.id}
                  type="button"
                  aria-label={
                    instanceCount === 0
                      ? `Add ${asset.name} to Scene`
                      : `Add another ${asset.name} to Scene, ${instanceCount} currently in Scene`
                  }
                  data-asset-id={asset.id}
                  data-asset-type={asset.type}
                  className="min-w-0 rounded border border-neutral-300 bg-white p-2 text-left transition-colors hover:border-neutral-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
                  onClick={() => addVehicle(asset.id)}
                >
                <div className="grid aspect-video w-full place-items-center rounded-sm border border-neutral-200 bg-neutral-100 p-3">
                  <img
                    src={asset.src}
                    alt=""
                    draggable={false}
                    className="max-h-full max-w-full"
                  />
                </div>
                <span className="mt-2 flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-sm font-medium text-neutral-800">
                    {asset.name}
                  </span>
                  <span className="shrink-0 text-xs font-medium text-emerald-800">
                    {instanceCount === 0
                      ? "Add"
                      : `${instanceCount} in scene`}
                  </span>
                </span>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </aside>
  );
}
