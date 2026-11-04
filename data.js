// ============================================================
//  AGRIGATE.ASIA — Operation Areas Data Configuration
// ============================================================
//  Verified 29 operations + Head Office across 4 categories:
//  1. CBF (Contract Broiler Farming)
//  2. CFF (Contract Fish Farming)
//  3. Egg Warehouse
//  4. Supply Chain
// ============================================================

export const BRANCH_TYPES = {
  "Headquarters": {
    label: "Head Office",
    color: "#2ecc71",
    beamBase: "#2ecc71",
    beamHead: "#ffffff",
    tagClass: "hq",
  },
  "CBF": {
    label: "CBF",
    color: "#2ecc71",
    beamBase: "#2ecc71",
    beamHead: "#a7f3d0",
    tagClass: "cbf",
  },
  "CFF": {
    label: "CFF",
    color: "#00e5ff",
    beamBase: "#00b4d8",
    beamHead: "#ffffff",
    tagClass: "cff",
  },
  "Supply Chain": {
    label: "Supply Chain",
    color: "#ff7a00",
    beamBase: "#ff7a00",
    beamHead: "#ffe0a8",
    tagClass: "supply-chain",
  },
  "Egg Warehouse": {
    label: "Egg Warehouse",
    color: "#a855f7",
    beamBase: "#7e22ce",
    beamHead: "#e879f9",
    tagClass: "egg-warehouse",
  },
  "Agrigate Factories": {
    label: "Agrigate Factory",
    color: "#00e676",
    beamBase: "#059669",
    beamHead: "#69f0ae",
    tagClass: "factory",
  },
};

export const MAP_CONFIG = {
  // Headquarters location (Dhaka)
  headquarters: {
    name: "Agrigate Head Office",
    type: "Headquarters",
    district: "Dhaka",
    phone: "+880 1324-741620",
    address: "House 09, Road 14, Block K, Baridhara Diplomatic Zone, Dhaka-1212",
  },

  // Color theme — Dark Futuristic Theme with Deep Emerald Map
  theme: {
    mapColor: "#1e3c32",              // Deep dark emerald surface color
    mapDepthColor: "#238842",         // Rich forest emerald vertical slab depth
    districtHoverColor: "#145946",     // Hover state (brighter emerald)
    districtSelectedColor: "#1b6a55",  // Active/selected district
    mapEdgeColor: "#00f7ff",         // Crisp electric cyan border outlines
    backgroundColor: "#050c16",      // Scene background (deep navy-black)
    gridColor: "#0d2137",            // Grid background
  },

  // ============================================================
  //  OPERATION AREAS (29 Hubs across Bangladesh)
  // ============================================================
  operationAreas: [
    // ----------------------------------------------------------
    //  1. CBF (Contract Broiler Farming) — 11 Branches
    // ----------------------------------------------------------
    {
      id: "cbf-rangpur",
      branchName: "CBF Rangpur Branch",
      district: "Rangpur",
      type: "CBF",
      phone: "+880 1313-719645",
      address: "Purbo khasbag (Satmatha Railgate), G L Roy Road, Mahiganj-5403, Kotoyali, Rangpur",
    },
    {
      id: "cbf-natore",
      branchName: "CBF Natore Branch",
      district: "Natore",
      type: "CBF",
      phone: "+880 1313-719660",
      address: "Holding No 30/1, Kalikapur, Bonpara Bypass, Boraigram, Natore",
    },
    {
      id: "cbf-rajshahi",
      branchName: "CBF Rajshahi Branch",
      district: "Rajshahi",
      type: "CBF",
      phone: "+880 1313-719685",
      address: "Shibpur Bazar, Baneswar, Puthia, Rajshahi",
    },
    {
      id: "cbf-jashore",
      branchName: "CBF Jashore Branch",
      district: "Jashore",
      type: "CBF",
      phone: "+880 1313-719675",
      address: "Shingiya Station, Basundia Mor, Jashore Sadar, Jashore",
    },
    {
      id: "cbf-bogura",
      branchName: "CBF Bagura Branch",
      district: "Bogura",
      type: "CBF",
      phone: "+880 1313-719690",
      address: "Jahedur cottage House-09, Road No-30, Upshahar Main Road, Bogura Sadar, Bogura",
    },
    {
      id: "cbf-mymensingh",
      branchName: "CBF Mymensingh Branch",
      district: "Mymensingh",
      type: "CBF",
      phone: "+880 1313-719605",
      address: "Amtoli, Shibgonj Road, Fulbaria, Mymensingh",
    },
    {
      id: "cbf-barisal",
      branchName: "CBF Barisal Branch",
      district: "Barisal",
      type: "CBF",
      phone: "+880 1335-076301",
      address: "Hatem Mir Dighi, Kashipur, Barishal",
      mapUrl: "https://maps.app.goo.gl/nEb4LvA9h8w43NQV8",
    },
    {
      id: "cbf-chattagong",
      branchName: "CBF Chittagong",
      district: "Chittagong",
      type: "CBF",
      phone: "+880 1335-076303",
      address: "Zorarganj Police Fari, Barayarhat, Mirsharai, Chittagong",
    },
    {
      id: "cbf-cumilla",
      branchName: "CBF Cumilla Branch",
      district: "Cumilla",
      type: "CBF",
      phone: "+880 1335-076302",
      address: "Haji Villa, Narayan Sar, Boro Bari, Holding No-380, Kalakochua Bazar, Burichong, Cumilla",
    },
    {
      id: "cbf-tangail",
      branchName: "CBF Tangail Branch",
      district: "Tangail",
      type: "CBF",
      phone: "+880 1335-076304",
      address: "Moshajan Bridge, Elenga Pouroshova, Elenga, Kalihati, Tangail",
    },
    {
      id: "cbf-dinajpur",
      branchName: "CBF Dinajpur Branch",
      district: "Dinajpur",
      type: "CBF",
      phone: "+880 1335-076305",
      address: "Hilli, Dinajpur",
    },

    // ----------------------------------------------------------
    //  2. CFF (Contract Fish Farming) — 1 Hub
    // ----------------------------------------------------------
    {
      id: "cff-sherpur",
      branchName: "Ashar Alo Fish Farming",
      district: "Sherpur",
      type: "CFF",
      phone: "+880 1313-719627",
      address: "Nalitabari, Gorkanda, Sherpur-2110",
    },

    // ----------------------------------------------------------
    //  3. Egg Warehouse — 3 Hubs
    // ----------------------------------------------------------
    {
      id: "egg-mohammadpur",
      branchName: "Egg Warehouse (Mohammadpur)",
      district: "Dhaka",
      type: "Egg Warehouse",
      phone: "+880 1313-719623",
      address: "Bashbari, Mondir Road, Mohammadpur, Dhaka",
    },
    {
      id: "egg-tejgaon",
      branchName: "Egg Warehouse (Tejgaon)",
      district: "Dhaka",
      type: "Egg Warehouse",
      phone: "+880 1313-719624",
      address: "Tejgaon Station Road, Tejgaon, Dhaka",
    },
    {
      id: "egg-tangail",
      branchName: "Egg Warehouse (Shakhipur)",
      district: "Tangail",
      type: "Egg Warehouse",
      phone: "+880 1313-719625",
      address: "Ghorbari Bazar, Shakhipur, Tangail",
    },

    // ----------------------------------------------------------
    //  4. Supply Chain — 17 Core SCM Hubs
    // ----------------------------------------------------------
    {
      id: "scm-naogaon",
      branchName: "Naogaon Supply Chain Hub",
      district: "Naogaon",
      type: "Supply Chain",
      phone: "+880 1951-041733",
      address: "Kathaltali, BSCIC, Naogaon",
    },
    {
      id: "scm-barisal",
      branchName: "Barisal Supply Chain Hub",
      district: "Barisal",
      type: "Supply Chain",
      phone: "+880 1951-041733",
      address: "Muladi, Barisal",
    },
    {
      id: "scm-dinajpur",
      branchName: "Dinajpur Supply Chain Hub",
      district: "Dinajpur",
      type: "Supply Chain",
      phone: "+880 1313-719676",
      address: "Dinajpur Sadar, Dinajpur",
    },
    {
      id: "scm-chapainababganj",
      branchName: "Chapainawabganj Supply Chain Hub",
      district: "Chapainababganj",
      type: "Supply Chain",
      phone: "+880 1313-719613",
      address: "Jamtala, Chapainababganj",
    },
    {
      id: "scm-rangpur",
      branchName: "Rangpur Supply Chain Hub",
      district: "Rangpur",
      type: "Supply Chain",
      phone: "+880 1313-719613",
      address: "Dimla, Dalia, Rangpur",
    },
    {
      id: "scm-bogura",
      branchName: "Bogura Supply Chain Hub",
      district: "Bogura",
      type: "Supply Chain",
      phone: "+880 1313-719613",
      address: "Mithapukur, Bogura",
    },
    {
      id: "scm-chuadanga",
      branchName: "Chuadanga Supply Chain Hub",
      district: "Chuadanga",
      type: "Supply Chain",
      phone: "+880 1797-262927",
      address: "Alamdanga, Chuadanga Sadar, Chuadanga",
    },
    {
      id: "scm-thakurgaon",
      branchName: "Thakurgaon Supply Chain Hub",
      district: "Thakurgaon",
      type: "Supply Chain",
      phone: "+880 1313-719631",
      address: "Pirganj, Haripur, Thakurgaon",
    },
    {
      id: "scm-nilphamari",
      branchName: "Nilphamari Supply Chain Hub",
      district: "Nilphamari",
      type: "Supply Chain",
      phone: "+880 1313-719676",
      address: "Nilphamari Sadar, Nilphamari",
    },
    {
      id: "scm-panchagarh",
      branchName: "Panchagarh Supply Chain Hub",
      district: "Panchagarh",
      type: "Supply Chain",
      phone: "+880 1313-719676",
      address: "Debiganj, Tetulia, Panchagarh",
    },
    {
      id: "scm-jhinaidaha",
      branchName: "Jhenaidah Supply Chain Hub",
      district: "Jhinaidaha",
      type: "Supply Chain",
      phone: "+880 1797-262927",
      address: "Jhinaidaha Sadar, Jhinaidaha",
    },
    {
      id: "scm-kushtia",
      branchName: "Kushtia Supply Chain Hub",
      district: "Kushtia",
      type: "Supply Chain",
      phone: "+880 1797-262927",
      address: "Kushtia Sadar, Kushtia",
    },
    {
      id: "scm-manikganj",
      branchName: "Manikganj Supply Chain Hub",
      district: "Manikganj",
      type: "Supply Chain",
      phone: "+880 1313-719637",
      address: "Ghior, Shibaloy, Manikganj",
    },
    {
      id: "scm-narayanganj",
      branchName: "Narayanganj Supply Chain Hub",
      district: "Narayanganj",
      type: "Supply Chain",
      phone: "+880 1740-474164",
      address: "Boidderbazar, Ladurchor, Narayanganj",
    },
    {
      id: "scm-lakshmipur",
      branchName: "Lakshmipur Supply Chain Hub",
      district: "Lakshmipur",
      type: "Supply Chain",
      phone: "+880 1740-474164",
      address: "Lakshmipur",
    },
    {
      id: "scm-chandpur",
      branchName: "Chandpur Supply Chain Hub",
      district: "Chandpur",
      type: "Supply Chain",
      phone: "+880 1740-474164",
      address: "Chandpur",
    },
    {
      id: "scm-lalmonirhat",
      branchName: "Lalmonirhat Supply Chain Hub",
      district: "Lalmonirhat",
      type: "Supply Chain",
      phone: "+880 1740-474164",
      address: "Lalmonirhat",
    },

    // ----------------------------------------------------------
    //  5. Agrigate Factories — 4 Factories
    // ----------------------------------------------------------
    {
      id: "factory-sirajganj",
      branchName: "Agrigate Feed Limited (Sirajganj)",
      district: "Sirajganj",
      type: "Agrigate Factories",
      phone: "+880 1324-741620",
      address: "Sirajganj",
    },
    {
      id: "factory-gaibandha",
      branchName: "Agrigate Farm Limited (Gaibandha)",
      district: "Gaibandha",
      type: "Agrigate Factories",
      phone: "+880 1324-741620",
      address: "Fashitola, Gaibandha",
    },
    {
      id: "factory-jaipurhat",
      branchName: "Agrigate Feed Limited (Joypurhat)",
      district: "Joypurhat",
      type: "Agrigate Factories",
      phone: "+880 1324-741620",
      address: "Jaipur Haat, Joypurhat",
    },
    {
      id: "factory-bogura",
      branchName: "Agrigate Farm Limited (Bogura)",
      district: "Bogura",
      type: "Agrigate Factories",
      phone: "+880 1324-741620",
      address: "Bogura",
    },
  ],
};
