import L from 'leaflet'

// Saturday, Sunday, and a third day for the three-day guides. Deep enough for white numerals.
export const itineraryDayColors = ['#0b63ce', '#5146c9', '#0f766e']
export const itineraryStopNumber = (day, order) => (day + 1) + '.' + (order + 1)

export function addItineraryRoute(layer, points, day, { dashed = false, color } = {}) {
    const style = { interactive: false, lineCap: 'round', lineJoin: 'round' }
    L.polyline(points, { ...style, color: '#fff', weight: 7, opacity: .95 }).addTo(layer)
    L.polyline(points, { ...style, color: color ?? itineraryDayColors[day], weight: 3.5, opacity: 1, dashArray: dashed ? '2 8' : null }).addTo(layer)
}
