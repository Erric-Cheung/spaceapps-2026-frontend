import { Database, Sprout } from 'lucide-react'

const DATA_REPO = 'https://github.com/insertusernamed/spaceapps-2026-data'

/** Plain-language project background, crop-rotation context, and data notes. */
function AboutStep() {
  return (
    <main className='about-step'>
      <h2>Planning the next crop</h2>
      <p className='about-intro'>
        Crop rotation means changing what you grow in a field from one season to the next,
        instead of planting the same crop every year. A simple example is corn one year,
        soybeans the next, then wheat or oats before returning to corn.
      </p>
      <p>
        Farmers rotate crops for practical reasons. It can help interrupt pest and disease
        cycles, balance the nutrients that different crops take from the soil, and spread
        risk instead of depending on one crop and one market. The right rotation depends on
        the soil, climate, equipment and markets, so no single plan fits every field.
      </p>

      <section className='about-section' aria-labelledby='about-how'>
        <h3 id='about-how'><Sprout size={20} aria-hidden='true' />How this tool helps</h3>
        <p>
          The map shows what has grown in each field in recent years, based on satellite
          crop maps. Review that history, correct anything that looks wrong, and add your
          next planting date. Those confirmed answers give the rotation suggestions a
          realistic starting point.
        </p>
      </section>

      <details className='about-details'>
        <summary><Database size={18} aria-hidden='true' />Where the data comes from</summary>
        <div className='about-details-body'>
          <p>
            Field boundaries and crop history are prepared by the project’s data pipeline,
            available in the{' '}
            <a className='about-link' href={DATA_REPO} target='_blank' rel='noreferrer'>
              spaceapps-2026-data repository
            </a>.
          </p>
          <p>
            Crop history comes from annual satellite crop maps, and previews use Harmonized
            Landsat-Sentinel imagery. Address search uses Photon with OpenStreetMap data.
            The basemap is from OpenFreeMap and OpenMapTiles. Map data © OpenStreetMap
            contributors.
          </p>
          <p>
            Field outlines are estimates, not legal property lines. Mapped crops come from
            satellite classifications and can be wrong or incomplete. A confirmed answer
            always takes priority over a mapped estimate.
          </p>
        </div>
      </details>
    </main>
  )
}

export default AboutStep
