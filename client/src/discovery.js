import { indiaGuides } from './indiaGuides.js'

export const guides = indiaGuides.map(guide => ({
    ...guide,
    author: 'Travemore',
    lat: guide.days[0].stops[0].lat,
    lng: guide.days[0].stops[0].lng,
}))

const places = [
 ['ashram','Sabarmati Ashram','Experiences',23.0607,72.5801,'4.6'],
 ['lake','Kankaria Lake','Experiences',23.006,72.601,'4.5'],
 ['mosque','Sidi Saiyyed Mosque','Experiences',23.0271,72.5812,'4.5'],
 ['museum','Calico Museum of Textiles','Experiences',23.0511,72.5908],
 ['market','Manek Chowk Food Market','Restaurants',23.0232,72.5864,''],
 ['hotel','Taj Skyline Ahmedabad','Stays',23.0325,72.4819,''],
 ['city','Ahmedabad','Locations',23.026,72.566,''],
];

const photographedPlaces = new Set(['ashram', 'lake', 'mosque'])
export const explorePlaces = places.map(([id, title, category, lat, lng, rating]) => ({
    id, title, category, lat, lng, rating,
    location: 'Ahmedabad, Gujarat',
    cover: photographedPlaces.has(id) ? `/discovery/${id}.webp` : '',
}))
