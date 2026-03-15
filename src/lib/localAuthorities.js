// England & Wales local authorities covered by the Land Registry HPI
// Sorted alphabetically within each region group

export const LOCAL_AUTHORITIES = [
  // London Boroughs
  'Barking and Dagenham', 'Barnet', 'Bexley', 'Brent', 'Bromley',
  'Camden', 'City of London', 'Croydon', 'Ealing', 'Enfield',
  'Greenwich', 'Hackney', 'Hammersmith and Fulham', 'Haringey', 'Harrow',
  'Havering', 'Hillingdon', 'Hounslow', 'Islington', 'Kensington and Chelsea',
  'Kingston upon Thames', 'Lambeth', 'Lewisham', 'Merton', 'Newham',
  'Redbridge', 'Richmond upon Thames', 'Southwark', 'Sutton', 'Tower Hamlets',
  'Waltham Forest', 'Wandsworth', 'Westminster',

  // Greater Manchester
  'Bolton', 'Bury', 'Manchester', 'Oldham', 'Rochdale',
  'Salford', 'Stockport', 'Tameside', 'Trafford', 'Wigan',

  // Merseyside
  'Knowsley', 'Liverpool', 'Sefton', 'St Helens', 'Wirral',

  // West Midlands
  'Birmingham', 'Coventry', 'Dudley', 'Sandwell', 'Solihull',
  'Walsall', 'Wolverhampton',

  // South Yorkshire
  'Barnsley', 'Doncaster', 'Rotherham', 'Sheffield',

  // West Yorkshire
  'Bradford', 'Calderdale', 'Kirklees', 'Leeds', 'Wakefield',

  // Tyne and Wear
  'Gateshead', 'Newcastle upon Tyne', 'North Tyneside', 'South Tyneside', 'Sunderland',

  // English Unitary Authorities (major)
  'Bath and North East Somerset', 'Bedford', 'Blackburn with Darwen', 'Blackpool',
  'Bournemouth Christchurch and Poole', 'Brighton and Hove', 'Bristol',
  'Buckinghamshire', 'Central Bedfordshire', 'Cheshire East', 'Cheshire West and Chester',
  'Cornwall', 'Cumberland', 'Darlington', 'Derby', 'Durham',
  'East Riding of Yorkshire', 'Halton', 'Hartlepool', 'Herefordshire',
  'Isle of Wight', 'Kingston upon Hull', 'Leicester', 'Luton',
  'Medway', 'Middlesbrough', 'Milton Keynes', 'North East Lincolnshire',
  'North Lincolnshire', 'North Somerset', 'North Yorkshire', 'Northumberland',
  'Nottingham', 'Peterborough', 'Plymouth', 'Portsmouth', 'Reading',
  'Redcar and Cleveland', 'Rutland', 'Shropshire', 'Slough', 'Somerset',
  'South Gloucestershire', 'Southampton', 'Southend-on-Sea', 'Stockton-on-Tees',
  'Stoke-on-Trent', 'Swindon', 'Telford and Wrekin', 'Thurrock', 'Torbay',
  'Warrington', 'West Berkshire', 'Wiltshire', 'Windsor and Maidenhead',
  'Wokingham', 'York',

  // Home Counties and Districts (selected)
  'Arun', 'Basildon', 'Braintree', 'Breckland', 'Brentwood', 'Broadland',
  'Bromsgrove', 'Broxbourne', 'Burnley', 'Cambridge', 'Cannock Chase',
  'Castle Point', 'Chelmsford', 'Cheltenham', 'Cherwell', 'Chichester',
  'Chorley', 'Colchester', 'Cotswold', 'Dacorum', 'Dover',
  'East Cambridgeshire', 'East Devon', 'East Hampshire', 'East Hertfordshire',
  'East Lindsey', 'Eastbourne', 'Eastleigh', 'Elmbridge', 'Epping Forest',
  'Epsom and Ewell', 'Exeter', 'Fareham', 'Forest of Dean', 'Guildford',
  'Harlow', 'Harrogate', 'Hertsmere', 'High Peak', 'Huntingdonshire',
  'Hyndburn', 'Ipswich', 'Lancaster', 'Lichfield', 'Maidstone', 'Maldon',
  'Mid Sussex', 'Mole Valley', 'New Forest', 'North Norfolk', 'Norwich',
  'Oxford', 'Reigate and Banstead', 'Runnymede', 'Rushcliffe', 'Rother',
  'Selby', 'Sevenoaks', 'South Cambridgeshire', 'South Norfolk', 'South Oxfordshire',
  'Spelthorne', 'St Albans', 'Stroud', 'Surrey Heath', 'Swale', 'Tandridge',
  'Teignbridge', 'Test Valley', 'Three Rivers', 'Tonbridge and Malling',
  'Tunbridge Wells', 'Uttlesford', 'Vale of White Horse', 'Waverley',
  'Wealden', 'Welwyn Hatfield', 'West Lindsey', 'West Oxfordshire', 'Winchester',
  'Woking', 'Worthing',

  // Wales
  'Blaenau Gwent', 'Bridgend', 'Caerphilly', 'Cardiff', 'Carmarthenshire',
  'Ceredigion', 'Conwy', 'Denbighshire', 'Flintshire', 'Gwynedd',
  'Isle of Anglesey', 'Merthyr Tydfil', 'Monmouthshire', 'Neath Port Talbot',
  'Newport', 'Pembrokeshire', 'Powys', 'Rhondda Cynon Taf', 'Swansea',
  'Torfaen', 'Vale of Glamorgan', 'Wrexham',
].sort()

// Derives the Land Registry URI slug from an LA name
// e.g. "Kensington and Chelsea" → "kensington-and-chelsea"
export function laToSlug(name) {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-{2,}/g, '-')
}
