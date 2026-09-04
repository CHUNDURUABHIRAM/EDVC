export const mockStations = [
  {
    id: "ST-001",
    name: "ChargeSpot Hub - Indiranagar",
    city: "Bengaluru",
    location: "100 Feet Rd, Indiranagar",
    coordinates: [12.9783, 77.6408],
    chargers: [
      { id: "C1", type: "CCS2", speed: "150kW", status: "AVAILABLE", price: 18.5 },
      { id: "C2", type: "CCS2", speed: "150kW", status: "OCCUPIED", price: 18.5 },
      { id: "C3", type: "Type 2", speed: "22kW", status: "AVAILABLE", price: 14.0 }
    ],
    amenities: ["Cafe", "Restrooms", "Wifi"],
    rating: 4.8,
    openHours: "24/7",
    // Engine signals
    networkApiStatus: "AVAILABLE",
    recentActivity: "LOW",
    activeSessions: 1,
    bookingQueue: 0,
    historicalDurations: [45, 30, 20]
  },
  {
    id: "ST-002",
    name: "GreenEnergy - HITECH City",
    city: "Hyderabad",
    location: "Mindspace IT Park",
    coordinates: [17.4435, 78.3772],
    chargers: [
      { id: "C1", type: "CCS2", speed: "50kW", status: "OCCUPIED", price: 15.0 },
      { id: "C2", type: "CCS2", speed: "50kW", status: "OCCUPIED", price: 15.0 },
      { id: "C3", type: "CHAdeMO", speed: "50kW", status: "AVAILABLE", price: 15.0 }
    ],
    amenities: ["Food Court", "Parking"],
    rating: 4.5,
    openHours: "06:00 - 23:00",
    networkApiStatus: "OCCUPIED",
    recentActivity: "HIGH",
    activeSessions: 2,
    bookingQueue: 1,
    historicalDurations: [60, 50]
  },
  {
    id: "ST-003",
    name: "ExpressCharge - T Nagar",
    city: "Chennai",
    location: "Pondy Bazaar",
    coordinates: [13.0401, 80.2337],
    chargers: [
      { id: "C1", type: "CCS2", speed: "60kW", status: "AVAILABLE", price: 16.0 },
      { id: "C2", type: "Type 2", speed: "22kW", status: "OFFLINE", price: 12.0 }
    ],
    amenities: ["Shopping"],
    rating: 4.2,
    openHours: "08:00 - 22:00",
    networkApiStatus: "AVAILABLE", // Conflicting signal example
    recentActivity: "HIGH",
    activeSessions: 0,
    bookingQueue: 1,
    historicalDurations: [30]
  },
  {
    id: "ST-004",
    name: "Zeus Point - BKC",
    city: "Mumbai",
    location: "Bandra Kurla Complex",
    coordinates: [19.0657, 72.8656],
    chargers: [
      { id: "C1", type: "CCS2", speed: "350kW", status: "AVAILABLE", price: 25.0 },
      { id: "C2", type: "CCS2", speed: "350kW", status: "AVAILABLE", price: 25.0 },
      { id: "C3", type: "CCS2", speed: "350kW", status: "OCCUPIED", price: 25.0 },
      { id: "C4", type: "Type 2", speed: "22kW", status: "AVAILABLE", price: 15.0 }
    ],
    amenities: ["Premium Lounge", "Wifi", "Cafe"],
    rating: 4.9,
    openHours: "24/7",
    networkApiStatus: "AVAILABLE",
    recentActivity: "MEDIUM",
    activeSessions: 1,
    bookingQueue: 0,
    historicalDurations: [15, 20]
  },
  {
    id: "ST-005",
    name: "CP Charger hub",
    city: "Delhi",
    location: "Connaught Place",
    coordinates: [28.6315, 77.2167],
    chargers: [
      { id: "C1", type: "CCS2", speed: "60kW", status: "OCCUPIED", price: 17.5 },
      { id: "C2", type: "CHAdeMO", speed: "50kW", status: "OCCUPIED", price: 17.5 }
    ],
    amenities: ["Restrooms", "Shopping"],
    rating: 4.0,
    openHours: "24/7",
    networkApiStatus: "AVAILABLE", // Intentional conflict for demo
    recentActivity: "HIGH",
    activeSessions: 2,
    bookingQueue: 2,
    historicalDurations: [45, 60]
  },
  {
    id: "ST-006",
    name: "Koregaon Park Plugs",
    city: "Pune",
    location: "Koregaon Park",
    coordinates: [18.5362, 73.8939],
    chargers: [
      { id: "C1", type: "CCS2", speed: "50kW", status: "AVAILABLE", price: 16.5 },
      { id: "C2", type: "Type 2", speed: "22kW", status: "AVAILABLE", price: 13.5 }
    ],
    amenities: ["Cafe", "Wifi"],
    rating: 4.7,
    openHours: "07:00 - 23:30",
    networkApiStatus: "AVAILABLE",
    recentActivity: "LOW",
    activeSessions: 0,
    bookingQueue: 0,
    historicalDurations: [45]
  },
  {
    id: "ST-007",
    name: "Highway Hub - NH16",
    city: "Vijayawada",
    location: "Benz Circle",
    coordinates: [16.4971, 80.6692],
    chargers: [
      { id: "C1", type: "CCS2", speed: "100kW", status: "OCCUPIED", price: 19.5 },
      { id: "C2", type: "CCS2", speed: "100kW", status: "AVAILABLE", price: 19.5 }
    ],
    amenities: ["Restrooms", "Food Court"],
    rating: 4.3,
    openHours: "24/7",
    networkApiStatus: "AVAILABLE",
    recentActivity: "MEDIUM",
    activeSessions: 1,
    bookingQueue: 0,
    historicalDurations: [30, 40]
  },
  {
    id: "ST-008",
    name: "Rushikonda Beach Chargers",
    city: "Visakhapatnam",
    location: "Beach Road",
    coordinates: [17.7813, 83.3854],
    chargers: [
      { id: "C1", type: "CCS2", speed: "30kW", status: "AVAILABLE", price: 15.0 },
      { id: "C2", type: "Type 2", speed: "22kW", status: "AVAILABLE", price: 12.0 }
    ],
    amenities: ["Scenic View", "Cafe"],
    rating: 4.6,
    openHours: "06:00 - 21:00",
    networkApiStatus: "AVAILABLE",
    recentActivity: "LOW",
    activeSessions: 0,
    bookingQueue: 0,
    historicalDurations: [60]
  },
  {
    id: "ST-009",
    name: "Oasis Mall EV Port",
    city: "Bengaluru",
    location: "Koramangala",
    coordinates: [12.9352, 77.6245],
    chargers: [
      { id: "C1", type: "CCS2", speed: "50kW", status: "OCCUPIED", price: 17.0 },
      { id: "C2", type: "CCS2", speed: "50kW", status: "OCCUPIED", price: 17.0 },
      { id: "C3", type: "CCS2", speed: "50kW", status: "OCCUPIED", price: 17.0 },
      { id: "C4", type: "Type 2", speed: "22kW", status: "OCCUPIED", price: 14.0 }
    ],
    amenities: ["Mall", "Restrooms", "Food Court"],
    rating: 4.1,
    openHours: "10:00 - 22:00",
    networkApiStatus: "OCCUPIED",
    recentActivity: "HIGH",
    activeSessions: 4,
    bookingQueue: 3,
    historicalDurations: [90, 80, 120, 60] // Mall chargers take longer
  },
  {
    id: "ST-010",
    name: "Gachibowli FastCharge",
    city: "Hyderabad",
    location: "Gachibowli Stadium Road",
    coordinates: [17.4399, 78.3489],
    chargers: [
      { id: "C1", type: "CCS2", speed: "150kW", status: "AVAILABLE", price: 20.0 },
      { id: "C2", type: "CCS2", speed: "150kW", status: "OFFLINE", price: 20.0 }
    ],
    amenities: ["Parking"],
    rating: 3.9,
    openHours: "24/7",
    networkApiStatus: "OFFLINE", // Conflict
    recentActivity: "MEDIUM",
    activeSessions: 0,
    bookingQueue: 0,
    historicalDurations: [20]
  }
];

// Start setting up initial localStorage config
// We no longer seed chargeSpotStations with mock data. It must be fetched from OCM API.
if (!localStorage.getItem('chargeSpotBookings')) {
  localStorage.setItem('chargeSpotBookings', JSON.stringify([]));
}
if (!localStorage.getItem('chargeSpotQueue')) {
  localStorage.setItem('chargeSpotQueue', JSON.stringify([]));
}
