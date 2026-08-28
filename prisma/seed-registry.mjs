/* GENERATED — do not edit by hand.
   Mirrors the place registry in `client/src/lib/cities.ts` and
   `client/src/lib/localities.ts` so `prisma db seed` provisions exactly the
   cities and localities the application routes, sitemaps, and SEO registry
   expect. `client/src/lib/seed-sync.test.ts` fails if the two drift apart.

   Regenerate with: node scripts/data/generate-seed-registry.mjs */

export const CITIES = [
  {
    "slug": "ahmedabad",
    "name": "Ahmedabad",
    "hindiName": "अमदावाद",
    "state": "Gujarat",
    "country": "IN",
    "latitude": "23.022500",
    "longitude": "72.571400"
  },
  {
    "slug": "mumbai",
    "name": "Mumbai",
    "hindiName": "मुंबई",
    "state": "Maharashtra",
    "country": "IN",
    "latitude": "19.076000",
    "longitude": "72.877700"
  },
  {
    "slug": "delhi",
    "name": "Delhi",
    "hindiName": "दिल्ली",
    "state": "Delhi",
    "country": "IN",
    "latitude": "28.613900",
    "longitude": "77.209000"
  },
  {
    "slug": "bengaluru",
    "name": "Bengaluru",
    "hindiName": "बेंगलुरु",
    "state": "Karnataka",
    "country": "IN",
    "latitude": "12.971600",
    "longitude": "77.594600"
  },
  {
    "slug": "hyderabad",
    "name": "Hyderabad",
    "hindiName": "हैदराबाद",
    "state": "Telangana",
    "country": "IN",
    "latitude": "17.385000",
    "longitude": "78.486700"
  },
  {
    "slug": "chennai",
    "name": "Chennai",
    "hindiName": "चेन्नई",
    "state": "Tamil Nadu",
    "country": "IN",
    "latitude": "13.082700",
    "longitude": "80.270700"
  },
  {
    "slug": "pune",
    "name": "Pune",
    "hindiName": "पुणे",
    "state": "Maharashtra",
    "country": "IN",
    "latitude": "18.520400",
    "longitude": "73.856700"
  },
  {
    "slug": "kolkata",
    "name": "Kolkata",
    "hindiName": "कोलकाता",
    "state": "West Bengal",
    "country": "IN",
    "latitude": "22.572600",
    "longitude": "88.363900"
  },
  {
    "slug": "gurugram",
    "name": "Gurugram",
    "hindiName": "गुरुग्राम",
    "state": "Haryana",
    "country": "IN",
    "latitude": "28.459500",
    "longitude": "77.026600"
  },
  {
    "slug": "noida",
    "name": "Noida",
    "hindiName": "नोएडा",
    "state": "Uttar Pradesh",
    "country": "IN",
    "latitude": "28.535500",
    "longitude": "77.391000"
  },
  {
    "slug": "surat",
    "name": "Surat",
    "hindiName": "सूरत",
    "state": "Gujarat",
    "country": "IN",
    "latitude": "21.170200",
    "longitude": "72.831100"
  },
  {
    "slug": "jaipur",
    "name": "Jaipur",
    "hindiName": "जयपुर",
    "state": "Rajasthan",
    "country": "IN",
    "latitude": "26.912400",
    "longitude": "75.787300"
  }
];

export const LOCALITIES = [
  {
    "citySlug": "ahmedabad",
    "slug": "paldi",
    "name": "Paldi",
    "hindiName": "पालडी",
    "note": "Tree-lined, central, quietly established",
    "demoHomeCount": 42,
    "latitude": "23.011000",
    "longitude": "72.559000",
    "bbox": "72.5350,22.9950,72.5850,23.0270",
    "landmarks": [
      [
        "Law Garden",
        "≈ 1.4 km"
      ],
      [
        "Sabarmati Riverfront",
        "≈ 1.8 km"
      ],
      [
        "Tagore Hall",
        "≈ 0.9 km"
      ],
      [
        "IIM Ahmedabad",
        "≈ 5.2 km"
      ],
      [
        "SVP Airport",
        "≈ 11.6 km"
      ]
    ]
  },
  {
    "citySlug": "ahmedabad",
    "slug": "navrangpura",
    "name": "Navrangpura",
    "hindiName": "नवरंगपुरा",
    "note": "Lively streets with a familiar pulse",
    "demoHomeCount": 31,
    "latitude": "23.039000",
    "longitude": "72.561000",
    "bbox": "72.5400,23.0250,72.5820,23.0530",
    "landmarks": [
      [
        "Gujarat College",
        "≈ 0.8 km"
      ],
      [
        "Law Garden",
        "≈ 1.2 km"
      ],
      [
        "Sabarmati Riverfront",
        "≈ 1.6 km"
      ],
      [
        "SVP Airport",
        "≈ 9.4 km"
      ]
    ]
  },
  {
    "citySlug": "ahmedabad",
    "slug": "prahlad-nagar",
    "name": "Prahlad Nagar",
    "hindiName": "प्रह्लाद नगर",
    "note": "Newer buildings, easy everyday rhythm",
    "demoHomeCount": 68,
    "latitude": "23.011000",
    "longitude": "72.507000",
    "bbox": "72.4880,22.9970,72.5260,23.0250"
  },
  {
    "citySlug": "ahmedabad",
    "slug": "thaltej",
    "name": "Thaltej",
    "hindiName": "थलतेज",
    "note": "Room to breathe at the western edge",
    "demoHomeCount": 54,
    "latitude": "23.052000",
    "longitude": "72.509000",
    "bbox": "72.4900,23.0380,72.5280,23.0660"
  },
  {
    "citySlug": "ahmedabad",
    "slug": "bopal",
    "name": "Bopal",
    "hindiName": "बोपल",
    "note": "Young families, wide roads, new schools",
    "demoHomeCount": 47,
    "latitude": "23.033000",
    "longitude": "72.464000",
    "bbox": "72.4450,23.0190,72.4830,23.0470"
  },
  {
    "citySlug": "ahmedabad",
    "slug": "satellite",
    "name": "Satellite",
    "hindiName": "सैटेलाइट",
    "note": "Connected, confident, always awake",
    "demoHomeCount": 39,
    "latitude": "23.023000",
    "longitude": "72.519000",
    "bbox": "72.5000,23.0090,72.5380,23.0370"
  },
  {
    "citySlug": "mumbai",
    "slug": "bandra-west",
    "name": "Bandra West",
    "hindiName": "बांद्रा पश्चिम",
    "note": "Sea-facing promenades and the city's most quoted address",
    "demoHomeCount": 58,
    "latitude": "19.059600",
    "longitude": "72.829500",
    "bbox": "72.8105,19.0456,72.8485,19.0736",
    "landmarks": [
      [
        "Bandra Bandstand",
        "≈ 1.1 km"
      ],
      [
        "Bandra–Worli Sea Link",
        "≈ 2.4 km"
      ],
      [
        "Bandra Terminus",
        "≈ 3.0 km"
      ]
    ]
  },
  {
    "citySlug": "mumbai",
    "slug": "andheri-west",
    "name": "Andheri West",
    "hindiName": "अंधेरी पश्चिम",
    "note": "Studios, suburban rail, and endless small commerce",
    "demoHomeCount": 96,
    "latitude": "19.136400",
    "longitude": "72.829600",
    "bbox": "72.8106,19.1224,72.8486,19.1504",
    "landmarks": [
      [
        "Andheri Station",
        "≈ 1.6 km"
      ],
      [
        "Versova Beach",
        "≈ 4.2 km"
      ],
      [
        "CSMI Airport T2",
        "≈ 5.1 km"
      ]
    ]
  },
  {
    "citySlug": "mumbai",
    "slug": "powai",
    "name": "Powai",
    "hindiName": "पवई",
    "note": "Lakeside campus town with planned streets",
    "demoHomeCount": 64,
    "latitude": "19.117600",
    "longitude": "72.906000",
    "bbox": "72.8870,19.1036,72.9250,19.1316",
    "landmarks": [
      [
        "Powai Lake",
        "≈ 0.7 km"
      ],
      [
        "IIT Bombay",
        "≈ 1.9 km"
      ],
      [
        "Hiranandani Gardens",
        "≈ 0.5 km"
      ]
    ]
  },
  {
    "citySlug": "mumbai",
    "slug": "chembur",
    "name": "Chembur",
    "hindiName": "चेंबूर",
    "note": "Central, green, and newly well connected",
    "demoHomeCount": 51,
    "latitude": "19.052200",
    "longitude": "72.900500",
    "bbox": "72.8815,19.0382,72.9195,19.0662"
  },
  {
    "citySlug": "mumbai",
    "slug": "goregaon-east",
    "name": "Goregaon East",
    "hindiName": "गोरेगांव पूर्व",
    "note": "Film-city side, big redevelopment pipeline",
    "demoHomeCount": 73,
    "latitude": "19.166300",
    "longitude": "72.852600",
    "bbox": "72.8336,19.1523,72.8716,19.1803"
  },
  {
    "citySlug": "mumbai",
    "slug": "thane-west",
    "name": "Thane West",
    "hindiName": "ठाणे पश्चिम",
    "note": "Lakes, malls, and the value end of the metro",
    "demoHomeCount": 112,
    "latitude": "19.218300",
    "longitude": "72.978100",
    "bbox": "72.9591,19.2043,72.9971,19.2323"
  },
  {
    "citySlug": "delhi",
    "slug": "dwarka",
    "name": "Dwarka",
    "hindiName": "द्वारका",
    "note": "Sub-city of societies, wide sectors, metro spine",
    "demoHomeCount": 88,
    "latitude": "28.592100",
    "longitude": "77.046000",
    "bbox": "77.0270,28.5781,77.0650,28.6061",
    "landmarks": [
      [
        "Dwarka Sector 21 Metro",
        "≈ 2.2 km"
      ],
      [
        "IGI Airport T3",
        "≈ 8.4 km"
      ]
    ]
  },
  {
    "citySlug": "delhi",
    "slug": "saket",
    "name": "Saket",
    "hindiName": "साकेत",
    "note": "South Delhi calm with malls at the doorstep",
    "demoHomeCount": 44,
    "latitude": "28.524500",
    "longitude": "77.206600",
    "bbox": "77.1876,28.5105,77.2256,28.5385",
    "landmarks": [
      [
        "Select Citywalk",
        "≈ 1.0 km"
      ],
      [
        "Qutub Minar",
        "≈ 3.6 km"
      ]
    ]
  },
  {
    "citySlug": "delhi",
    "slug": "vasant-kunj",
    "name": "Vasant Kunj",
    "hindiName": "वसंत कुंज",
    "note": "Ridge forest edges and diplomatic quiet",
    "demoHomeCount": 37,
    "latitude": "28.520000",
    "longitude": "77.159100",
    "bbox": "77.1401,28.5060,77.1781,28.5340"
  },
  {
    "citySlug": "delhi",
    "slug": "rohini",
    "name": "Rohini",
    "hindiName": "रोहिणी",
    "note": "Planned North-West grid, strong resale depth",
    "demoHomeCount": 79,
    "latitude": "28.749500",
    "longitude": "77.056500",
    "bbox": "77.0375,28.7355,77.0755,28.7635"
  },
  {
    "citySlug": "delhi",
    "slug": "mayur-vihar",
    "name": "Mayur Vihar",
    "hindiName": "मयूर विहार",
    "note": "Yamuna-side societies, easy Noida access",
    "demoHomeCount": 56,
    "latitude": "28.608900",
    "longitude": "77.295200",
    "bbox": "77.2762,28.5949,77.3142,28.6229"
  },
  {
    "citySlug": "delhi",
    "slug": "punjabi-bagh",
    "name": "Punjabi Bagh",
    "hindiName": "पंजाबी बाग",
    "note": "Builder floors on West Delhi's widest roads",
    "demoHomeCount": 41,
    "latitude": "28.666300",
    "longitude": "77.131000",
    "bbox": "77.1120,28.6523,77.1500,28.6803"
  },
  {
    "citySlug": "bengaluru",
    "slug": "indiranagar",
    "name": "Indiranagar",
    "hindiName": "इंदिरानगर",
    "note": "Old bungalow plots turned into the city's best walk",
    "demoHomeCount": 46,
    "latitude": "12.978400",
    "longitude": "77.640800",
    "bbox": "77.6218,12.9644,77.6598,12.9924",
    "landmarks": [
      [
        "100 Feet Road",
        "≈ 0.4 km"
      ],
      [
        "Indiranagar Metro",
        "≈ 1.1 km"
      ],
      [
        "Ulsoor Lake",
        "≈ 2.6 km"
      ]
    ]
  },
  {
    "citySlug": "bengaluru",
    "slug": "koramangala",
    "name": "Koramangala",
    "hindiName": "कोरमंगला",
    "note": "Startup blocks, cafés, and short commutes",
    "demoHomeCount": 62,
    "latitude": "12.935200",
    "longitude": "77.624500",
    "bbox": "77.6055,12.9212,77.6435,12.9492"
  },
  {
    "citySlug": "bengaluru",
    "slug": "whitefield",
    "name": "Whitefield",
    "hindiName": "व्हाइटफील्ड",
    "note": "Tech parks, gated townships, and new metro",
    "demoHomeCount": 128,
    "latitude": "12.969800",
    "longitude": "77.750000",
    "bbox": "77.7310,12.9558,77.7690,12.9838",
    "landmarks": [
      [
        "ITPL",
        "≈ 2.0 km"
      ],
      [
        "Whitefield Metro",
        "≈ 1.4 km"
      ]
    ]
  },
  {
    "citySlug": "bengaluru",
    "slug": "hsr-layout",
    "name": "HSR Layout",
    "hindiName": "एचएसआर लेआउट",
    "note": "Sector grid, parks, and the flat-hunt favourite",
    "demoHomeCount": 84,
    "latitude": "12.911600",
    "longitude": "77.647400",
    "bbox": "77.6284,12.8976,77.6664,12.9256"
  },
  {
    "citySlug": "bengaluru",
    "slug": "hebbal",
    "name": "Hebbal",
    "hindiName": "हेब्बाल",
    "note": "Lake views and the cleanest run to the airport",
    "demoHomeCount": 59,
    "latitude": "13.035800",
    "longitude": "77.597000",
    "bbox": "77.5780,13.0218,77.6160,13.0498"
  },
  {
    "citySlug": "bengaluru",
    "slug": "electronic-city",
    "name": "Electronic City",
    "hindiName": "इलेक्ट्रॉनिक सिटी",
    "note": "Elevated expressway, employer-adjacent value",
    "demoHomeCount": 103,
    "latitude": "12.845200",
    "longitude": "77.660200",
    "bbox": "77.6412,12.8312,77.6792,12.8592"
  },
  {
    "citySlug": "hyderabad",
    "slug": "gachibowli",
    "name": "Gachibowli",
    "hindiName": "गचीबौली",
    "note": "Financial district frontage, still filling in",
    "demoHomeCount": 91,
    "latitude": "17.440100",
    "longitude": "78.348900",
    "bbox": "78.3299,17.4261,78.3679,17.4541",
    "landmarks": [
      [
        "Financial District",
        "≈ 3.1 km"
      ],
      [
        "Gachibowli Stadium",
        "≈ 1.2 km"
      ]
    ]
  },
  {
    "citySlug": "hyderabad",
    "slug": "hitec-city",
    "name": "HITEC City",
    "hindiName": "हाईटेक सिटी",
    "note": "Towers, skywalks, and the shortest tech commute",
    "demoHomeCount": 77,
    "latitude": "17.443500",
    "longitude": "78.377200",
    "bbox": "78.3582,17.4295,78.3962,17.4575"
  },
  {
    "citySlug": "hyderabad",
    "slug": "kondapur",
    "name": "Kondapur",
    "hindiName": "कोंडापुर",
    "note": "Mid-market depth right behind the tech belt",
    "demoHomeCount": 86,
    "latitude": "17.461500",
    "longitude": "78.362000",
    "bbox": "78.3430,17.4475,78.3810,17.4755"
  },
  {
    "citySlug": "hyderabad",
    "slug": "banjara-hills",
    "name": "Banjara Hills",
    "hindiName": "बंजारा हिल्स",
    "note": "Rock outcrops, road numbers, and old money",
    "demoHomeCount": 38,
    "latitude": "17.412600",
    "longitude": "78.439200",
    "bbox": "78.4202,17.3986,78.4582,17.4266"
  },
  {
    "citySlug": "hyderabad",
    "slug": "jubilee-hills",
    "name": "Jubilee Hills",
    "hindiName": "जुबली हिल्स",
    "note": "The city's most deliberate architecture",
    "demoHomeCount": 33,
    "latitude": "17.423900",
    "longitude": "78.473800",
    "bbox": "78.4548,17.4099,78.4928,17.4379"
  },
  {
    "citySlug": "hyderabad",
    "slug": "kukatpally",
    "name": "Kukatpally",
    "hindiName": "कुकटपल्ली",
    "note": "Dense, well-served, and priced for families",
    "demoHomeCount": 94,
    "latitude": "17.484900",
    "longitude": "78.413800",
    "bbox": "78.3948,17.4709,78.4328,17.4989"
  },
  {
    "citySlug": "chennai",
    "slug": "adyar",
    "name": "Adyar",
    "hindiName": "अड्यार",
    "note": "River, banyan shade, and settled institutions",
    "demoHomeCount": 43,
    "latitude": "13.006700",
    "longitude": "80.257000",
    "bbox": "80.2380,12.9927,80.2760,13.0207",
    "landmarks": [
      [
        "Adyar Estuary",
        "≈ 1.5 km"
      ],
      [
        "Elliot's Beach",
        "≈ 2.8 km"
      ]
    ]
  },
  {
    "citySlug": "chennai",
    "slug": "anna-nagar",
    "name": "Anna Nagar",
    "hindiName": "अन्ना नगर",
    "note": "Planned blocks, tower park, deep resale market",
    "demoHomeCount": 61,
    "latitude": "13.085000",
    "longitude": "80.210100",
    "bbox": "80.1911,13.0710,80.2291,13.0990"
  },
  {
    "citySlug": "chennai",
    "slug": "velachery",
    "name": "Velachery",
    "hindiName": "वेलाचेरी",
    "note": "Central-south connector with everything nearby",
    "demoHomeCount": 72,
    "latitude": "12.975000",
    "longitude": "80.221000",
    "bbox": "80.2020,12.9610,80.2400,12.9890"
  },
  {
    "citySlug": "chennai",
    "slug": "thoraipakkam",
    "name": "Thoraipakkam (OMR)",
    "hindiName": "तोरैपक्कम",
    "note": "IT corridor frontage on Old Mahabalipuram Road",
    "demoHomeCount": 89,
    "latitude": "12.940100",
    "longitude": "80.234000",
    "bbox": "80.2150,12.9261,80.2530,12.9541"
  },
  {
    "citySlug": "chennai",
    "slug": "t-nagar",
    "name": "T. Nagar",
    "hindiName": "टी नगर",
    "note": "Retail heart — loud, central, always liquid",
    "demoHomeCount": 35,
    "latitude": "13.041800",
    "longitude": "80.234100",
    "bbox": "80.2151,13.0278,80.2531,13.0558"
  },
  {
    "citySlug": "chennai",
    "slug": "porur",
    "name": "Porur",
    "hindiName": "पोरूर",
    "note": "Western junction, hospitals, and fast new roads",
    "demoHomeCount": 66,
    "latitude": "13.035900",
    "longitude": "80.156500",
    "bbox": "80.1375,13.0219,80.1755,13.0499"
  },
  {
    "citySlug": "pune",
    "slug": "kharadi",
    "name": "Kharadi",
    "hindiName": "खराडी",
    "note": "River-bend offices and premium new towers",
    "demoHomeCount": 87,
    "latitude": "18.551500",
    "longitude": "73.947000",
    "bbox": "73.9280,18.5375,73.9660,18.5655",
    "landmarks": [
      [
        "EON IT Park",
        "≈ 1.3 km"
      ],
      [
        "Pune Airport",
        "≈ 7.8 km"
      ]
    ]
  },
  {
    "citySlug": "pune",
    "slug": "baner",
    "name": "Baner",
    "hindiName": "बाणेर",
    "note": "Hill slopes, highway access, young households",
    "demoHomeCount": 78,
    "latitude": "18.559000",
    "longitude": "73.786800",
    "bbox": "73.7678,18.5450,73.8058,18.5730"
  },
  {
    "citySlug": "pune",
    "slug": "hinjawadi",
    "name": "Hinjawadi",
    "hindiName": "हिंजवडी",
    "note": "Rajiv Gandhi Infotech Park and its housing belt",
    "demoHomeCount": 118,
    "latitude": "18.591300",
    "longitude": "73.738900",
    "bbox": "73.7199,18.5773,73.7579,18.6053"
  },
  {
    "citySlug": "pune",
    "slug": "wakad",
    "name": "Wakad",
    "hindiName": "वाकड",
    "note": "Bridge to Hinjawadi with better everyday retail",
    "demoHomeCount": 92,
    "latitude": "18.597500",
    "longitude": "73.762500",
    "bbox": "73.7435,18.5835,73.7815,18.6115"
  },
  {
    "citySlug": "pune",
    "slug": "kothrud",
    "name": "Kothrud",
    "hindiName": "कोथरूड",
    "note": "Old Pune character with genuinely walkable lanes",
    "demoHomeCount": 54,
    "latitude": "18.507400",
    "longitude": "73.807700",
    "bbox": "73.7887,18.4934,73.8267,18.5214"
  },
  {
    "citySlug": "pune",
    "slug": "viman-nagar",
    "name": "Viman Nagar",
    "hindiName": "विमान नगर",
    "note": "Airport-side, cosmopolitan, well stocked",
    "demoHomeCount": 63,
    "latitude": "18.567900",
    "longitude": "73.914300",
    "bbox": "73.8953,18.5539,73.9333,18.5819"
  },
  {
    "citySlug": "kolkata",
    "slug": "salt-lake-sector-v",
    "name": "Salt Lake Sector V",
    "hindiName": "साल्ट लेक सेक्टर V",
    "note": "The IT block, with metro finally attached",
    "demoHomeCount": 57,
    "latitude": "22.576000",
    "longitude": "88.433000",
    "bbox": "88.4140,22.5620,88.4520,22.5900"
  },
  {
    "citySlug": "kolkata",
    "slug": "new-town-rajarhat",
    "name": "New Town Rajarhat",
    "hindiName": "न्यू टाउन राजारहाट",
    "note": "Widest roads in the state, still growing into them",
    "demoHomeCount": 104,
    "latitude": "22.580000",
    "longitude": "88.460000",
    "bbox": "88.4410,22.5660,88.4790,22.5940"
  },
  {
    "citySlug": "kolkata",
    "slug": "ballygunge",
    "name": "Ballygunge",
    "hindiName": "बालीगंज",
    "note": "South Kolkata's verandahs and old plane trees",
    "demoHomeCount": 39,
    "latitude": "22.529000",
    "longitude": "88.365000",
    "bbox": "88.3460,22.5150,88.3840,22.5430"
  },
  {
    "citySlug": "kolkata",
    "slug": "tollygunge",
    "name": "Tollygunge",
    "hindiName": "टॉलीगंज",
    "note": "Club greens, studios, and metro at the door",
    "demoHomeCount": 48,
    "latitude": "22.498000",
    "longitude": "88.343000",
    "bbox": "88.3240,22.4840,88.3620,22.5120"
  },
  {
    "citySlug": "kolkata",
    "slug": "behala",
    "name": "Behala",
    "hindiName": "बेहाला",
    "note": "Deep south-west value with new metro reach",
    "demoHomeCount": 67,
    "latitude": "22.499000",
    "longitude": "88.316000",
    "bbox": "88.2970,22.4850,88.3350,22.5130"
  },
  {
    "citySlug": "kolkata",
    "slug": "howrah",
    "name": "Howrah",
    "hindiName": "हावड़ा",
    "note": "Across the bridge — the cheapest way into the metro",
    "demoHomeCount": 71,
    "latitude": "22.595800",
    "longitude": "88.263600",
    "bbox": "88.2446,22.5818,88.2826,22.6098"
  },
  {
    "citySlug": "gurugram",
    "slug": "golf-course-road",
    "name": "Golf Course Road",
    "hindiName": "गोल्फ कोर्स रोड",
    "note": "The premium spine — towers, clubs, rapid metro",
    "demoHomeCount": 69,
    "latitude": "28.421100",
    "longitude": "77.096100",
    "bbox": "77.0771,28.4071,77.1151,28.4351"
  },
  {
    "citySlug": "gurugram",
    "slug": "dlf-phase-5",
    "name": "DLF Phase 5",
    "hindiName": "डीएलएफ फेज 5",
    "note": "Established condominiums with mature landscaping",
    "demoHomeCount": 52,
    "latitude": "28.439000",
    "longitude": "77.103000",
    "bbox": "77.0840,28.4250,77.1220,28.4530"
  },
  {
    "citySlug": "gurugram",
    "slug": "sohna-road",
    "name": "Sohna Road",
    "hindiName": "सोहना रोड",
    "note": "Mid-market corridor with the shortest office hops",
    "demoHomeCount": 83,
    "latitude": "28.408900",
    "longitude": "77.037800",
    "bbox": "77.0188,28.3949,77.0568,28.4229"
  },
  {
    "citySlug": "gurugram",
    "slug": "sushant-lok",
    "name": "Sushant Lok",
    "hindiName": "सुशांत लोक",
    "note": "Builder floors and greenery, centrally placed",
    "demoHomeCount": 58,
    "latitude": "28.467400",
    "longitude": "77.070800",
    "bbox": "77.0518,28.4534,77.0898,28.4814"
  },
  {
    "citySlug": "gurugram",
    "slug": "new-gurugram",
    "name": "New Gurugram",
    "hindiName": "न्यू गुरुग्राम",
    "note": "Dwarka Expressway sectors, still under construction",
    "demoHomeCount": 97,
    "latitude": "28.376000",
    "longitude": "76.950000",
    "bbox": "76.9310,28.3620,76.9690,28.3900"
  },
  {
    "citySlug": "gurugram",
    "slug": "mg-road-gurugram",
    "name": "MG Road",
    "hindiName": "एमजी रोड",
    "note": "Delhi-border malls and the original metro stretch",
    "demoHomeCount": 44,
    "latitude": "28.479500",
    "longitude": "77.080500",
    "bbox": "77.0615,28.4655,77.0995,28.4935"
  },
  {
    "citySlug": "noida",
    "slug": "noida-sector-150",
    "name": "Sector 150",
    "hindiName": "सेक्टर 150",
    "note": "Eighty percent green — the planned showpiece",
    "demoHomeCount": 74,
    "latitude": "28.426500",
    "longitude": "77.488000",
    "bbox": "77.4690,28.4125,77.5070,28.4405"
  },
  {
    "citySlug": "noida",
    "slug": "noida-sector-62",
    "name": "Sector 62",
    "hindiName": "सेक्टर 62",
    "note": "Office cluster with metro and older societies",
    "demoHomeCount": 53,
    "latitude": "28.627000",
    "longitude": "77.372000",
    "bbox": "77.3530,28.6130,77.3910,28.6410"
  },
  {
    "citySlug": "noida",
    "slug": "noida-sector-137",
    "name": "Sector 137",
    "hindiName": "सेक्टर 137",
    "note": "Expressway frontage, high-rise rentals",
    "demoHomeCount": 81,
    "latitude": "28.509000",
    "longitude": "77.403000",
    "bbox": "77.3840,28.4950,77.4220,28.5230"
  },
  {
    "citySlug": "noida",
    "slug": "noida-sector-78",
    "name": "Sector 78",
    "hindiName": "सेक्टर 78",
    "note": "Large townships, schools, and metro at 76",
    "demoHomeCount": 88,
    "latitude": "28.568000",
    "longitude": "77.383000",
    "bbox": "77.3640,28.5540,77.4020,28.5820"
  },
  {
    "citySlug": "noida",
    "slug": "noida-extension",
    "name": "Noida Extension",
    "hindiName": "नोएडा एक्सटेंशन",
    "note": "Greater Noida West — the affordability engine",
    "demoHomeCount": 132,
    "latitude": "28.610000",
    "longitude": "77.430000",
    "bbox": "77.4110,28.5960,77.4490,28.6240"
  },
  {
    "citySlug": "noida",
    "slug": "greater-noida-alpha",
    "name": "Greater Noida Alpha",
    "hindiName": "ग्रेटर नोएडा अल्फा",
    "note": "Institutional belt, plotted housing, quiet roads",
    "demoHomeCount": 47,
    "latitude": "28.477000",
    "longitude": "77.510000",
    "bbox": "77.4910,28.4630,77.5290,28.4910"
  },
  {
    "citySlug": "surat",
    "slug": "vesu",
    "name": "Vesu",
    "hindiName": "वेसू",
    "note": "The city's premium address, planned and green",
    "demoHomeCount": 76,
    "latitude": "21.141800",
    "longitude": "72.771000",
    "bbox": "72.7520,21.1278,72.7900,21.1558"
  },
  {
    "citySlug": "surat",
    "slug": "adajan",
    "name": "Adajan",
    "hindiName": "अडाजण",
    "note": "Riverside, family-dense, everything within reach",
    "demoHomeCount": 84,
    "latitude": "21.195900",
    "longitude": "72.793300",
    "bbox": "72.7743,21.1819,72.8123,21.2099"
  },
  {
    "citySlug": "surat",
    "slug": "pal",
    "name": "Pal",
    "hindiName": "पाल",
    "note": "New towers west of the Tapi, fast approvals",
    "demoHomeCount": 62,
    "latitude": "21.178000",
    "longitude": "72.762000",
    "bbox": "72.7430,21.1640,72.7810,21.1920"
  },
  {
    "citySlug": "surat",
    "slug": "piplod",
    "name": "Piplod",
    "hindiName": "पिपलोद",
    "note": "Between the airport road and the good schools",
    "demoHomeCount": 49,
    "latitude": "21.154000",
    "longitude": "72.776000",
    "bbox": "72.7570,21.1400,72.7950,21.1680"
  },
  {
    "citySlug": "surat",
    "slug": "althan",
    "name": "Althan",
    "hindiName": "अल्थाण",
    "note": "Southern growth ring, value per square foot",
    "demoHomeCount": 58,
    "latitude": "21.155000",
    "longitude": "72.796000",
    "bbox": "72.7770,21.1410,72.8150,21.1690"
  },
  {
    "citySlug": "surat",
    "slug": "dumas-road",
    "name": "Dumas Road",
    "hindiName": "डुमस रोड",
    "note": "Coast-bound corridor with resort-style projects",
    "demoHomeCount": 41,
    "latitude": "21.120000",
    "longitude": "72.730000",
    "bbox": "72.7110,21.1060,72.7490,21.1340"
  },
  {
    "citySlug": "jaipur",
    "slug": "vaishali-nagar",
    "name": "Vaishali Nagar",
    "hindiName": "वैशाली नगर",
    "note": "North-west hub with the busiest retail street",
    "demoHomeCount": 68,
    "latitude": "26.912400",
    "longitude": "75.740000",
    "bbox": "75.7210,26.8984,75.7590,26.9264"
  },
  {
    "citySlug": "jaipur",
    "slug": "mansarovar",
    "name": "Mansarovar",
    "hindiName": "मानसरोवर",
    "note": "Asia's largest planned colony, still orderly",
    "demoHomeCount": 92,
    "latitude": "26.850000",
    "longitude": "75.760000",
    "bbox": "75.7410,26.8360,75.7790,26.8640"
  },
  {
    "citySlug": "jaipur",
    "slug": "malviya-nagar",
    "name": "Malviya Nagar",
    "hindiName": "मालवीय नगर",
    "note": "Institutional, central-south, consistently liquid",
    "demoHomeCount": 57,
    "latitude": "26.854000",
    "longitude": "75.806000",
    "bbox": "75.7870,26.8400,75.8250,26.8680"
  },
  {
    "citySlug": "jaipur",
    "slug": "jagatpura",
    "name": "Jagatpura",
    "hindiName": "जगतपुरा",
    "note": "Ring-road side plots and new apartment stock",
    "demoHomeCount": 73,
    "latitude": "26.821000",
    "longitude": "75.856000",
    "bbox": "75.8370,26.8070,75.8750,26.8350"
  },
  {
    "citySlug": "jaipur",
    "slug": "c-scheme",
    "name": "C-Scheme",
    "hindiName": "सी-स्कीम",
    "note": "Colonial-era plots, the city's most guarded address",
    "demoHomeCount": 29,
    "latitude": "26.908000",
    "longitude": "75.794000",
    "bbox": "75.7750,26.8940,75.8130,26.9220"
  },
  {
    "citySlug": "jaipur",
    "slug": "ajmer-road",
    "name": "Ajmer Road",
    "hindiName": "अजमेर रोड",
    "note": "Westward highway corridor, fastest new supply",
    "demoHomeCount": 64,
    "latitude": "26.890000",
    "longitude": "75.730000",
    "bbox": "75.7110,26.8760,75.7490,26.9040"
  }
];
