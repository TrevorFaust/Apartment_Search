/** Major US cities for location autocomplete (city + state). */
export type UsCity = { city: string; state: string };

export const US_CITIES: UsCity[] = [
  { city: "New York", state: "NY" },
  { city: "Los Angeles", state: "CA" },
  { city: "Chicago", state: "IL" },
  { city: "Houston", state: "TX" },
  { city: "Phoenix", state: "AZ" },
  { city: "Philadelphia", state: "PA" },
  { city: "San Antonio", state: "TX" },
  { city: "San Diego", state: "CA" },
  { city: "Dallas", state: "TX" },
  { city: "Austin", state: "TX" },
  { city: "Jacksonville", state: "FL" },
  { city: "San Jose", state: "CA" },
  { city: "Fort Worth", state: "TX" },
  { city: "Columbus", state: "OH" },
  { city: "Charlotte", state: "NC" },
  { city: "Indianapolis", state: "IN" },
  { city: "San Francisco", state: "CA" },
  { city: "Seattle", state: "WA" },
  { city: "Denver", state: "CO" },
  { city: "Washington", state: "DC" },
  { city: "Boston", state: "MA" },
  { city: "Nashville", state: "TN" },
  { city: "Detroit", state: "MI" },
  { city: "Portland", state: "OR" },
  { city: "Las Vegas", state: "NV" },
  { city: "Memphis", state: "TN" },
  { city: "Louisville", state: "KY" },
  { city: "Baltimore", state: "MD" },
  { city: "Milwaukee", state: "WI" },
  { city: "Albuquerque", state: "NM" },
  { city: "Tucson", state: "AZ" },
  { city: "Fresno", state: "CA" },
  { city: "Sacramento", state: "CA" },
  { city: "Atlanta", state: "GA" },
  { city: "Kansas City", state: "MO" },
  { city: "Miami", state: "FL" },
  { city: "Raleigh", state: "NC" },
  { city: "Omaha", state: "NE" },
  { city: "Minneapolis", state: "MN" },
  { city: "Cleveland", state: "OH" },
  { city: "Tampa", state: "FL" },
  { city: "New Orleans", state: "LA" },
  { city: "Honolulu", state: "HI" },
  { city: "Oakland", state: "CA" },
  { city: "Pittsburgh", state: "PA" },
  { city: "Cincinnati", state: "OH" },
  { city: "St. Louis", state: "MO" },
  { city: "Orlando", state: "FL" },
  { city: "Salt Lake City", state: "UT" },
  { city: "Madison", state: "WI" },
  { city: "Boise", state: "ID" },
  { city: "Richmond", state: "VA" },
  { city: "Spokane", state: "WA" },
  { city: "Tacoma", state: "WA" },
  { city: "Bellevue", state: "WA" },
  { city: "Boulder", state: "CO" },
  { city: "Ann Arbor", state: "MI" },
  { city: "Cambridge", state: "MA" },
  { city: "Berkeley", state: "CA" },
  { city: "Santa Monica", state: "CA" },
  { city: "Pasadena", state: "CA" },
  { city: "Long Beach", state: "CA" },
  { city: "Anaheim", state: "CA" },
  { city: "Irvine", state: "CA" },
  { city: "Riverside", state: "CA" },
  { city: "Brooklyn", state: "NY" },
  { city: "Queens", state: "NY" },
  { city: "Arlington", state: "VA" },
  { city: "Alexandria", state: "VA" },
  { city: "Durham", state: "NC" },
  { city: "Charleston", state: "SC" },
  { city: "Savannah", state: "GA" },
  { city: "Providence", state: "RI" },
  { city: "Hartford", state: "CT" },
  { city: "Buffalo", state: "NY" },
  { city: "Rochester", state: "NY" },
  { city: "Columbia", state: "SC" },
  { city: "Des Moines", state: "IA" },
  { city: "Little Rock", state: "AR" },
  { city: "Oklahoma City", state: "OK" },
  { city: "Tulsa", state: "OK" },
  { city: "El Paso", state: "TX" },
  { city: "Corpus Christi", state: "TX" },
  { city: "Lubbock", state: "TX" },
  { city: "Anchorage", state: "AK" },
  { city: "Reno", state: "NV" },
  { city: "Chandler", state: "AZ" },
  { city: "Scottsdale", state: "AZ" },
  { city: "Glendale", state: "AZ" },
  { city: "Mesa", state: "AZ" },
  { city: "Colorado Springs", state: "CO" },
  { city: "Fort Collins", state: "CO" },
  { city: "Eugene", state: "OR" },
  { city: "Salem", state: "OR" },
  { city: "Bend", state: "OR" },
  { city: "Santa Fe", state: "NM" },
  { city: "Asheville", state: "NC" },
  { city: "Knoxville", state: "TN" },
  { city: "Chattanooga", state: "TN" },
  { city: "Lexington", state: "KY" },
  { city: "Grand Rapids", state: "MI" },
  { city: "Dayton", state: "OH" },
  { city: "Toledo", state: "OH" },
  { city: "Akron", state: "OH" },
  { city: "Wichita", state: "KS" },
  { city: "Lincoln", state: "NE" },
  { city: "Sioux Falls", state: "SD" },
  { city: "Fargo", state: "ND" },
  { city: "Billings", state: "MT" },
  { city: "Cheyenne", state: "WY" },
  { city: "Wilmington", state: "DE" },
  { city: "Jersey City", state: "NJ" },
  { city: "Newark", state: "NJ" },
  { city: "Hoboken", state: "NJ" },
  { city: "St. Paul", state: "MN" },
  { city: "Green Bay", state: "WI" },
  { city: "Mobile", state: "AL" },
  { city: "Birmingham", state: "AL" },
  { city: "Montgomery", state: "AL" },
  { city: "Jackson", state: "MS" },
  { city: "Baton Rouge", state: "LA" },
  { city: "Shreveport", state: "LA" },
  { city: "Lafayette", state: "LA" },
];

export function formatCityOption(c: UsCity): string {
  return `${c.city}, ${c.state}`;
}

export function searchUsCities(query: string, limit = 8): UsCity[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  const scored: Array<{ city: UsCity; score: number }> = [];
  for (const c of US_CITIES) {
    const city = c.city.toLowerCase();
    const label = `${city}, ${c.state.toLowerCase()}`;
    if (city.startsWith(q)) scored.push({ city: c, score: 0 });
    else if (label.startsWith(q)) scored.push({ city: c, score: 1 });
    else if (city.includes(q)) scored.push({ city: c, score: 2 });
    else if (label.includes(q)) scored.push({ city: c, score: 3 });
  }

  scored.sort((a, b) => a.score - b.score || a.city.city.localeCompare(b.city.city));
  return scored.slice(0, limit).map((s) => s.city);
}

export function normalizeLocationInput(city: string, state: string) {
  return {
    city: city.toLowerCase().trim(),
    state: state.toUpperCase().trim().slice(0, 2).toLowerCase(),
  };
}
