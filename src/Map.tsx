import { useEffect, useRef } from 'react'
import { LeafletMap, TileLayer } from 'leaflet'
import 'leaflet/styles.css'

export default function Map() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const map = new LeafletMap(ref.current!).setView([51.505, -0.09], 13)

    new TileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map)

    return () => {
      map.remove()
    }
  }, [])

  return <div ref={ref} style={{ height: '100vh', width: '100%' }} />
}
