/** Approximate city centroids (WGS84) for marketplace matching — not survey-grade. */
export type CityCoords = { latitude: number; longitude: number; provinceCode: string };

export const IRAN_CITY_COORDS: Record<string, CityCoords> = {
  "Tehran": {
    "latitude": 35.6892,
    "longitude": 51.389,
    "provinceCode": "TE"
  },
  "Rey": {
    "latitude": 35.4442,
    "longitude": 51.189,
    "provinceCode": "TE"
  },
  "Eslamshahr": {
    "latitude": 35.4792,
    "longitude": 51.229,
    "provinceCode": "TE"
  },
  "Shahriar": {
    "latitude": 35.5142,
    "longitude": 51.269,
    "provinceCode": "TE"
  },
  "Malard": {
    "latitude": 35.5492,
    "longitude": 51.309,
    "provinceCode": "TE"
  },
  "Pakdasht": {
    "latitude": 35.5842,
    "longitude": 51.349,
    "provinceCode": "TE"
  },
  "Varamin": {
    "latitude": 35.6192,
    "longitude": 51.389,
    "provinceCode": "TE"
  },
  "Damavand": {
    "latitude": 35.6542,
    "longitude": 51.429,
    "provinceCode": "TE"
  },
  "Firuzkuh": {
    "latitude": 35.6892,
    "longitude": 51.469,
    "provinceCode": "TE"
  },
  "Pardis": {
    "latitude": 35.7242,
    "longitude": 51.509,
    "provinceCode": "TE"
  },
  "Robat Karim": {
    "latitude": 35.7592,
    "longitude": 51.549,
    "provinceCode": "TE"
  },
  "Qods": {
    "latitude": 35.7942,
    "longitude": 51.589,
    "provinceCode": "TE"
  },
  "Baharestan": {
    "latitude": 35.8292,
    "longitude": 51.629,
    "provinceCode": "TE"
  },
  "Pishva": {
    "latitude": 35.8642,
    "longitude": 51.149,
    "provinceCode": "TE"
  },
  "Hashtgerd": {
    "latitude": 36.05,
    "longitude": 50.7391,
    "provinceCode": "AL"
  },
  "Karaj": {
    "latitude": 35.84,
    "longitude": 50.9391,
    "provinceCode": "AL"
  },
  "Fardis": {
    "latitude": 36.12,
    "longitude": 50.8191,
    "provinceCode": "AL"
  },
  "Mohammadshahr": {
    "latitude": 35.56,
    "longitude": 50.8591,
    "provinceCode": "AL"
  },
  "Nazarabad": {
    "latitude": 35.595,
    "longitude": 50.8991,
    "provinceCode": "AL"
  },
  "Taleqan": {
    "latitude": 35.63,
    "longitude": 50.9391,
    "provinceCode": "AL"
  },
  "Eshtehard": {
    "latitude": 35.665,
    "longitude": 50.9791,
    "provinceCode": "AL"
  },
  "Savojbolagh": {
    "latitude": 35.7,
    "longitude": 51.0191,
    "provinceCode": "AL"
  },
  "Isfahan": {
    "latitude": 32.6546,
    "longitude": 51.668,
    "provinceCode": "IS"
  },
  "Kashan": {
    "latitude": 33.985,
    "longitude": 51.41,
    "provinceCode": "IS"
  },
  "Najafabad": {
    "latitude": 32.6342,
    "longitude": 51.3662,
    "provinceCode": "IS"
  },
  "Khomeinishahr": {
    "latitude": 32.6546,
    "longitude": 51.908,
    "provinceCode": "IS"
  },
  "Shahinshahr": {
    "latitude": 32.6896,
    "longitude": 51.428,
    "provinceCode": "IS"
  },
  "Fooladshahr": {
    "latitude": 32.7246,
    "longitude": 51.468,
    "provinceCode": "IS"
  },
  "Mobarakeh": {
    "latitude": 32.7596,
    "longitude": 51.508,
    "provinceCode": "IS"
  },
  "Falavarjan": {
    "latitude": 32.7946,
    "longitude": 51.548,
    "provinceCode": "IS"
  },
  "Natanz": {
    "latitude": 32.8296,
    "longitude": 51.588,
    "provinceCode": "IS"
  },
  "Ardestan": {
    "latitude": 32.8646,
    "longitude": 51.628,
    "provinceCode": "IS"
  },
  "Nain": {
    "latitude": 32.8996,
    "longitude": 51.668,
    "provinceCode": "IS"
  },
  "Semirom": {
    "latitude": 32.9346,
    "longitude": 51.708,
    "provinceCode": "IS"
  },
  "Shahreza": {
    "latitude": 32.3746,
    "longitude": 51.748,
    "provinceCode": "IS"
  },
  "Golpayegan": {
    "latitude": 32.4096,
    "longitude": 51.788,
    "provinceCode": "IS"
  },
  "Khansar": {
    "latitude": 32.4446,
    "longitude": 51.828,
    "provinceCode": "IS"
  },
  "Aran va Bidgol": {
    "latitude": 32.4796,
    "longitude": 51.868,
    "provinceCode": "IS"
  },
  "Lenjan": {
    "latitude": 32.5146,
    "longitude": 51.908,
    "provinceCode": "IS"
  },
  "Tiran": {
    "latitude": 32.5496,
    "longitude": 51.428,
    "provinceCode": "IS"
  },
  "Shiraz": {
    "latitude": 29.5918,
    "longitude": 52.5837,
    "provinceCode": "FA"
  },
  "Marvdasht": {
    "latitude": 29.5568,
    "longitude": 52.4237,
    "provinceCode": "FA"
  },
  "Jahrom": {
    "latitude": 29.5918,
    "longitude": 52.4637,
    "provinceCode": "FA"
  },
  "Fasa": {
    "latitude": 29.6268,
    "longitude": 52.5037,
    "provinceCode": "FA"
  },
  "Kazerun": {
    "latitude": 29.6618,
    "longitude": 52.5437,
    "provinceCode": "FA"
  },
  "Lar": {
    "latitude": 29.6968,
    "longitude": 52.5837,
    "provinceCode": "FA"
  },
  "Abadeh": {
    "latitude": 29.7318,
    "longitude": 52.6237,
    "provinceCode": "FA"
  },
  "Neyriz": {
    "latitude": 29.7668,
    "longitude": 52.6637,
    "provinceCode": "FA"
  },
  "Darab": {
    "latitude": 29.8018,
    "longitude": 52.7037,
    "provinceCode": "FA"
  },
  "Firuzabad": {
    "latitude": 29.8368,
    "longitude": 52.7437,
    "provinceCode": "FA"
  },
  "Estahban": {
    "latitude": 29.8718,
    "longitude": 52.7837,
    "provinceCode": "FA"
  },
  "Lamerd": {
    "latitude": 29.3118,
    "longitude": 52.8237,
    "provinceCode": "FA"
  },
  "Gerash": {
    "latitude": 29.3468,
    "longitude": 52.3437,
    "provinceCode": "FA"
  },
  "Mashhad": {
    "latitude": 36.2605,
    "longitude": 59.6168,
    "provinceCode": "RK"
  },
  "Neyshabur": {
    "latitude": 36.2133,
    "longitude": 58.7958,
    "provinceCode": "RK"
  },
  "Sabzevar": {
    "latitude": 36.2126,
    "longitude": 57.6819,
    "provinceCode": "RK"
  },
  "Torbat-e Heydarieh": {
    "latitude": 36.1555,
    "longitude": 59.5368,
    "provinceCode": "RK"
  },
  "Quchan": {
    "latitude": 36.1905,
    "longitude": 59.5768,
    "provinceCode": "RK"
  },
  "Torbat-e Jam": {
    "latitude": 36.2255,
    "longitude": 59.6168,
    "provinceCode": "RK"
  },
  "Kashmar": {
    "latitude": 35.2383,
    "longitude": 58.4656,
    "provinceCode": "RK"
  },
  "Gonabad": {
    "latitude": 36.2955,
    "longitude": 59.6968,
    "provinceCode": "RK"
  },
  "Chenaran": {
    "latitude": 36.3305,
    "longitude": 59.7368,
    "provinceCode": "RK"
  },
  "Dargaz": {
    "latitude": 36.3655,
    "longitude": 59.7768,
    "provinceCode": "RK"
  },
  "Taybad": {
    "latitude": 36.4005,
    "longitude": 59.8168,
    "provinceCode": "RK"
  },
  "Sarakhs": {
    "latitude": 36.4355,
    "longitude": 59.8568,
    "provinceCode": "RK"
  },
  "Tabriz": {
    "latitude": 38.0962,
    "longitude": 46.2738,
    "provinceCode": "EA"
  },
  "Maragheh": {
    "latitude": 37.3891,
    "longitude": 46.237,
    "provinceCode": "EA"
  },
  "Marand": {
    "latitude": 38.4329,
    "longitude": 45.7749,
    "provinceCode": "EA"
  },
  "Ahar": {
    "latitude": 37.8162,
    "longitude": 46.1538,
    "provinceCode": "EA"
  },
  "Mianeh": {
    "latitude": 37.8512,
    "longitude": 46.1938,
    "provinceCode": "EA"
  },
  "Bonab": {
    "latitude": 37.8862,
    "longitude": 46.2338,
    "provinceCode": "EA"
  },
  "Sarab": {
    "latitude": 37.9212,
    "longitude": 46.2738,
    "provinceCode": "EA"
  },
  "Azarshahr": {
    "latitude": 37.9562,
    "longitude": 46.3138,
    "provinceCode": "EA"
  },
  "Shabestar": {
    "latitude": 37.9912,
    "longitude": 46.3538,
    "provinceCode": "EA"
  },
  "Jolfa": {
    "latitude": 38.0262,
    "longitude": 46.3938,
    "provinceCode": "EA"
  },
  "Urmia": {
    "latitude": 37.5527,
    "longitude": 45.0761,
    "provinceCode": "WA"
  },
  "Khoy": {
    "latitude": 38.5503,
    "longitude": 44.9521,
    "provinceCode": "WA"
  },
  "Mahabad": {
    "latitude": 36.7631,
    "longitude": 45.7222,
    "provinceCode": "WA"
  },
  "Miandoab": {
    "latitude": 37.6227,
    "longitude": 44.8361,
    "provinceCode": "WA"
  },
  "Boukan": {
    "latitude": 37.6577,
    "longitude": 44.8761,
    "provinceCode": "WA"
  },
  "Salmas": {
    "latitude": 37.6927,
    "longitude": 44.9161,
    "provinceCode": "WA"
  },
  "Piranshahr": {
    "latitude": 37.7277,
    "longitude": 44.9561,
    "provinceCode": "WA"
  },
  "Oshnavieh": {
    "latitude": 37.7627,
    "longitude": 44.9961,
    "provinceCode": "WA"
  },
  "Maku": {
    "latitude": 37.7977,
    "longitude": 45.0361,
    "provinceCode": "WA"
  },
  "Sardasht": {
    "latitude": 37.8327,
    "longitude": 45.0761,
    "provinceCode": "WA"
  },
  "Takab": {
    "latitude": 37.2727,
    "longitude": 45.1161,
    "provinceCode": "WA"
  },
  "Ahvaz": {
    "latitude": 31.3183,
    "longitude": 48.6706,
    "provinceCode": "KZ"
  },
  "Abadan": {
    "latitude": 30.3473,
    "longitude": 48.2934,
    "provinceCode": "KZ"
  },
  "Khorramshahr": {
    "latitude": 31.1433,
    "longitude": 48.8306,
    "provinceCode": "KZ"
  },
  "Dezful": {
    "latitude": 32.3831,
    "longitude": 48.4236,
    "provinceCode": "KZ"
  },
  "Andimeshk": {
    "latitude": 31.2133,
    "longitude": 48.9106,
    "provinceCode": "KZ"
  },
  "Bandar-e Mahshahr": {
    "latitude": 31.2483,
    "longitude": 48.4306,
    "provinceCode": "KZ"
  },
  "Behbahan": {
    "latitude": 31.2833,
    "longitude": 48.4706,
    "provinceCode": "KZ"
  },
  "Shushtar": {
    "latitude": 31.3183,
    "longitude": 48.5106,
    "provinceCode": "KZ"
  },
  "Izeh": {
    "latitude": 31.3533,
    "longitude": 48.5506,
    "provinceCode": "KZ"
  },
  "Masjed Soleyman": {
    "latitude": 31.3883,
    "longitude": 48.5906,
    "provinceCode": "KZ"
  },
  "Ramhormoz": {
    "latitude": 31.4233,
    "longitude": 48.6306,
    "provinceCode": "KZ"
  },
  "Shush": {
    "latitude": 31.4583,
    "longitude": 48.6706,
    "provinceCode": "KZ"
  },
  "Omidiyeh": {
    "latitude": 31.4933,
    "longitude": 48.7106,
    "provinceCode": "KZ"
  },
  "Gotvand": {
    "latitude": 31.5283,
    "longitude": 48.7506,
    "provinceCode": "KZ"
  },
  "Sari": {
    "latitude": 36.5633,
    "longitude": 53.0601,
    "provinceCode": "MN"
  },
  "Amol": {
    "latitude": 36.4697,
    "longitude": 52.3508,
    "provinceCode": "MN"
  },
  "Babol": {
    "latitude": 36.5513,
    "longitude": 52.6786,
    "provinceCode": "MN"
  },
  "Qaemshahr": {
    "latitude": 36.4631,
    "longitude": 52.8601,
    "provinceCode": "MN"
  },
  "Chalus": {
    "latitude": 36.655,
    "longitude": 51.4204,
    "provinceCode": "MN"
  },
  "Nowshahr": {
    "latitude": 36.6485,
    "longitude": 51.496,
    "provinceCode": "MN"
  },
  "Tonekabon": {
    "latitude": 36.8163,
    "longitude": 50.8738,
    "provinceCode": "MN"
  },
  "Ramsar": {
    "latitude": 36.9031,
    "longitude": 50.6583,
    "provinceCode": "MN"
  },
  "Behshahr": {
    "latitude": 36.4933,
    "longitude": 52.9801,
    "provinceCode": "MN"
  },
  "Neka": {
    "latitude": 36.5283,
    "longitude": 53.0201,
    "provinceCode": "MN"
  },
  "Mahmudabad": {
    "latitude": 36.5633,
    "longitude": 53.0601,
    "provinceCode": "MN"
  },
  "Babolsar": {
    "latitude": 36.5983,
    "longitude": 53.1001,
    "provinceCode": "MN"
  },
  "Juybar": {
    "latitude": 36.6333,
    "longitude": 53.1401,
    "provinceCode": "MN"
  },
  "Rasht": {
    "latitude": 37.2808,
    "longitude": 49.5832,
    "provinceCode": "GI"
  },
  "Bandar-e Anzali": {
    "latitude": 37.4725,
    "longitude": 49.4622,
    "provinceCode": "GI"
  },
  "Lahijan": {
    "latitude": 37.2071,
    "longitude": 50.0039,
    "provinceCode": "GI"
  },
  "Langarud": {
    "latitude": 37.4908,
    "longitude": 49.8232,
    "provinceCode": "GI"
  },
  "Sowmeeh Sara": {
    "latitude": 37.5258,
    "longitude": 49.3432,
    "provinceCode": "GI"
  },
  "Astara": {
    "latitude": 37.5608,
    "longitude": 49.3832,
    "provinceCode": "GI"
  },
  "Talesh": {
    "latitude": 37.0008,
    "longitude": 49.4232,
    "provinceCode": "GI"
  },
  "Rudsar": {
    "latitude": 37.0358,
    "longitude": 49.4632,
    "provinceCode": "GI"
  },
  "Fuman": {
    "latitude": 37.0708,
    "longitude": 49.5032,
    "provinceCode": "GI"
  },
  "Shaft": {
    "latitude": 37.1058,
    "longitude": 49.5432,
    "provinceCode": "GI"
  },
  "Rudbar": {
    "latitude": 37.1408,
    "longitude": 49.5832,
    "provinceCode": "GI"
  },
  "Astaneh-ye Ashrafiyeh": {
    "latitude": 37.1758,
    "longitude": 49.6232,
    "provinceCode": "GI"
  },
  "Kerman": {
    "latitude": 30.2839,
    "longitude": 57.0788,
    "provinceCode": "KE"
  },
  "Sirjan": {
    "latitude": 29.4514,
    "longitude": 55.6814,
    "provinceCode": "KE"
  },
  "Rafsanjan": {
    "latitude": 30.4067,
    "longitude": 55.9939,
    "provinceCode": "KE"
  },
  "Jiroft": {
    "latitude": 28.6751,
    "longitude": 57.741,
    "provinceCode": "KE"
  },
  "Bam": {
    "latitude": 29.106,
    "longitude": 58.357,
    "provinceCode": "KE"
  },
  "Zarand": {
    "latitude": 30.3889,
    "longitude": 56.8388,
    "provinceCode": "KE"
  },
  "Kahnuj": {
    "latitude": 30.4239,
    "longitude": 56.8788,
    "provinceCode": "KE"
  },
  "Shahr-e Babak": {
    "latitude": 30.4589,
    "longitude": 56.9188,
    "provinceCode": "KE"
  },
  "Zahedan": {
    "latitude": 29.4963,
    "longitude": 60.8629,
    "provinceCode": "SB"
  },
  "Zabol": {
    "latitude": 31.0309,
    "longitude": 61.4912,
    "provinceCode": "SB"
  },
  "Chabahar": {
    "latitude": 25.2919,
    "longitude": 60.643,
    "provinceCode": "SB"
  },
  "Iranshahr": {
    "latitude": 29.2163,
    "longitude": 60.8629,
    "provinceCode": "SB"
  },
  "Saravan": {
    "latitude": 29.2513,
    "longitude": 60.9029,
    "provinceCode": "SB"
  },
  "Khash": {
    "latitude": 29.2863,
    "longitude": 60.9429,
    "provinceCode": "SB"
  },
  "Konarak": {
    "latitude": 29.3213,
    "longitude": 60.9829,
    "provinceCode": "SB"
  },
  "Bandar Abbas": {
    "latitude": 27.1832,
    "longitude": 56.2666,
    "provinceCode": "HG"
  },
  "Minab": {
    "latitude": 27.1467,
    "longitude": 57.0801,
    "provinceCode": "HG"
  },
  "Qeshm": {
    "latitude": 26.9581,
    "longitude": 56.2719,
    "provinceCode": "HG"
  },
  "Bandar Lengeh": {
    "latitude": 27.1482,
    "longitude": 56.0266,
    "provinceCode": "HG"
  },
  "Kish": {
    "latitude": 26.557,
    "longitude": 53.98,
    "provinceCode": "HG"
  },
  "Hajiabad": {
    "latitude": 27.2182,
    "longitude": 56.1066,
    "provinceCode": "HG"
  },
  "Rudan": {
    "latitude": 27.2532,
    "longitude": 56.1466,
    "provinceCode": "HG"
  },
  "Kermanshah": {
    "latitude": 34.3142,
    "longitude": 47.065,
    "provinceCode": "KS"
  },
  "Eslamabad-e Gharb": {
    "latitude": 34.4542,
    "longitude": 47.025,
    "provinceCode": "KS"
  },
  "Javanrud": {
    "latitude": 34.4892,
    "longitude": 47.065,
    "provinceCode": "KS"
  },
  "Kangavar": {
    "latitude": 34.5242,
    "longitude": 47.105,
    "provinceCode": "KS"
  },
  "Sonqor": {
    "latitude": 34.5592,
    "longitude": 47.145,
    "provinceCode": "KS"
  },
  "Sahneh": {
    "latitude": 34.5942,
    "longitude": 47.185,
    "provinceCode": "KS"
  },
  "Paveh": {
    "latitude": 34.0342,
    "longitude": 47.225,
    "provinceCode": "KS"
  },
  "Sarpol-e Zahab": {
    "latitude": 34.0692,
    "longitude": 47.265,
    "provinceCode": "KS"
  },
  "Khorramabad": {
    "latitude": 33.4878,
    "longitude": 48.3558,
    "provinceCode": "LO"
  },
  "Borujerd": {
    "latitude": 33.8974,
    "longitude": 48.7516,
    "provinceCode": "LO"
  },
  "Dorud": {
    "latitude": 33.3478,
    "longitude": 48.1558,
    "provinceCode": "LO"
  },
  "Aligudarz": {
    "latitude": 33.3828,
    "longitude": 48.1958,
    "provinceCode": "LO"
  },
  "Kuhdasht": {
    "latitude": 33.4178,
    "longitude": 48.2358,
    "provinceCode": "LO"
  },
  "Nurabad": {
    "latitude": 33.4528,
    "longitude": 48.2758,
    "provinceCode": "LO"
  },
  "Azna": {
    "latitude": 33.4878,
    "longitude": 48.3158,
    "provinceCode": "LO"
  },
  "Pol-e Dokhtar": {
    "latitude": 33.5228,
    "longitude": 48.3558,
    "provinceCode": "LO"
  },
  "Hamedan": {
    "latitude": 34.7983,
    "longitude": 48.5148,
    "provinceCode": "HM"
  },
  "Malayer": {
    "latitude": 34.2969,
    "longitude": 48.8235,
    "provinceCode": "HM"
  },
  "Nahavand": {
    "latitude": 34.9383,
    "longitude": 48.6348,
    "provinceCode": "HM"
  },
  "Asadabad": {
    "latitude": 34.9733,
    "longitude": 48.6748,
    "provinceCode": "HM"
  },
  "Tuyserkan": {
    "latitude": 35.0083,
    "longitude": 48.7148,
    "provinceCode": "HM"
  },
  "Kabudarahang": {
    "latitude": 35.0433,
    "longitude": 48.7548,
    "provinceCode": "HM"
  },
  "Razan": {
    "latitude": 35.0783,
    "longitude": 48.2748,
    "provinceCode": "HM"
  },
  "Arak": {
    "latitude": 34.0917,
    "longitude": 49.6892,
    "provinceCode": "MK"
  },
  "Saveh": {
    "latitude": 35.0213,
    "longitude": 50.3566,
    "provinceCode": "MK"
  },
  "Khomein": {
    "latitude": 33.8817,
    "longitude": 49.5692,
    "provinceCode": "MK"
  },
  "Mahallat": {
    "latitude": 33.9167,
    "longitude": 49.6092,
    "provinceCode": "MK"
  },
  "Delijan": {
    "latitude": 33.9517,
    "longitude": 49.6492,
    "provinceCode": "MK"
  },
  "Tafresh": {
    "latitude": 33.9867,
    "longitude": 49.6892,
    "provinceCode": "MK"
  },
  "Ashtian": {
    "latitude": 34.0217,
    "longitude": 49.7292,
    "provinceCode": "MK"
  },
  "Shazand": {
    "latitude": 34.0567,
    "longitude": 49.7692,
    "provinceCode": "MK"
  },
  "Qazvin": {
    "latitude": 36.2688,
    "longitude": 50.0041,
    "provinceCode": "QZ"
  },
  "Takestan": {
    "latitude": 36.3038,
    "longitude": 50.1641,
    "provinceCode": "QZ"
  },
  "Alvand": {
    "latitude": 36.3388,
    "longitude": 50.2041,
    "provinceCode": "QZ"
  },
  "Abyek": {
    "latitude": 36.3738,
    "longitude": 50.2441,
    "provinceCode": "QZ"
  },
  "Buin Zahra": {
    "latitude": 36.4088,
    "longitude": 49.7641,
    "provinceCode": "QZ"
  },
  "Qom": {
    "latitude": 34.6416,
    "longitude": 50.8746,
    "provinceCode": "QM"
  },
  "Yazd": {
    "latitude": 31.8974,
    "longitude": 54.3569,
    "provinceCode": "YZ"
  },
  "Ardakan": {
    "latitude": 32.1424,
    "longitude": 54.2369,
    "provinceCode": "YZ"
  },
  "Meybod": {
    "latitude": 32.1774,
    "longitude": 54.2769,
    "provinceCode": "YZ"
  },
  "Bafq": {
    "latitude": 31.6174,
    "longitude": 54.3169,
    "provinceCode": "YZ"
  },
  "Mehriz": {
    "latitude": 31.6524,
    "longitude": 54.3569,
    "provinceCode": "YZ"
  },
  "Taft": {
    "latitude": 31.6874,
    "longitude": 54.3969,
    "provinceCode": "YZ"
  },
  "Abarkuh": {
    "latitude": 31.7224,
    "longitude": 54.4369,
    "provinceCode": "YZ"
  },
  "Zanjan": {
    "latitude": 36.6736,
    "longitude": 48.4787,
    "provinceCode": "ZN"
  },
  "Abhar": {
    "latitude": 36.5686,
    "longitude": 48.6387,
    "provinceCode": "ZN"
  },
  "Khorramdarreh": {
    "latitude": 36.6036,
    "longitude": 48.6787,
    "provinceCode": "ZN"
  },
  "Qeydar": {
    "latitude": 36.6386,
    "longitude": 48.7187,
    "provinceCode": "ZN"
  },
  "Tarom": {
    "latitude": 36.6736,
    "longitude": 48.2387,
    "provinceCode": "ZN"
  },
  "Semnan": {
    "latitude": 35.5729,
    "longitude": 53.3971,
    "provinceCode": "SM"
  },
  "Shahrud": {
    "latitude": 36.4181,
    "longitude": 54.9763,
    "provinceCode": "SM"
  },
  "Damghan": {
    "latitude": 35.6779,
    "longitude": 53.2771,
    "provinceCode": "SM"
  },
  "Garmsar": {
    "latitude": 35.7129,
    "longitude": 53.3171,
    "provinceCode": "SM"
  },
  "Mehdishahr": {
    "latitude": 35.7479,
    "longitude": 53.3571,
    "provinceCode": "SM"
  },
  "Gorgan": {
    "latitude": 36.8456,
    "longitude": 54.4393,
    "provinceCode": "GO"
  },
  "Gonbad-e Kavus": {
    "latitude": 37.25,
    "longitude": 55.1672,
    "provinceCode": "GO"
  },
  "Aliabad-e Katul": {
    "latitude": 37.1256,
    "longitude": 54.5193,
    "provinceCode": "GO"
  },
  "Bandar Torkaman": {
    "latitude": 36.5656,
    "longitude": 54.5593,
    "provinceCode": "GO"
  },
  "Aqqala": {
    "latitude": 36.6006,
    "longitude": 54.5993,
    "provinceCode": "GO"
  },
  "Kalaleh": {
    "latitude": 36.6356,
    "longitude": 54.6393,
    "provinceCode": "GO"
  },
  "Minudasht": {
    "latitude": 36.6706,
    "longitude": 54.6793,
    "provinceCode": "GO"
  },
  "Kordkuy": {
    "latitude": 36.7056,
    "longitude": 54.1993,
    "provinceCode": "GO"
  },
  "Ardabil": {
    "latitude": 38.2498,
    "longitude": 48.2933,
    "provinceCode": "AR"
  },
  "Parsabad": {
    "latitude": 39.6482,
    "longitude": 47.9174,
    "provinceCode": "AR"
  },
  "Meshginshahr": {
    "latitude": 38.2148,
    "longitude": 48.1733,
    "provinceCode": "AR"
  },
  "Khalkhal": {
    "latitude": 38.2498,
    "longitude": 48.2133,
    "provinceCode": "AR"
  },
  "Germi": {
    "latitude": 38.2848,
    "longitude": 48.2533,
    "provinceCode": "AR"
  },
  "Bilehsavar": {
    "latitude": 38.3198,
    "longitude": 48.2933,
    "provinceCode": "AR"
  },
  "Sanandaj": {
    "latitude": 35.3219,
    "longitude": 46.9862,
    "provinceCode": "KD"
  },
  "Saqqez": {
    "latitude": 36.2499,
    "longitude": 46.2735,
    "provinceCode": "KD"
  },
  "Marivan": {
    "latitude": 35.5219,
    "longitude": 46.176,
    "provinceCode": "KD"
  },
  "Baneh": {
    "latitude": 35.5319,
    "longitude": 47.1462,
    "provinceCode": "KD"
  },
  "Qorveh": {
    "latitude": 35.5669,
    "longitude": 47.1862,
    "provinceCode": "KD"
  },
  "Bijar": {
    "latitude": 35.6019,
    "longitude": 47.2262,
    "provinceCode": "KD"
  },
  "Divandarreh": {
    "latitude": 35.0419,
    "longitude": 46.7462,
    "provinceCode": "KD"
  },
  "Kamyaran": {
    "latitude": 35.0769,
    "longitude": 46.7862,
    "provinceCode": "KD"
  },
  "Ilam": {
    "latitude": 33.6374,
    "longitude": 46.4226,
    "provinceCode": "IL"
  },
  "Dehloran": {
    "latitude": 33.4624,
    "longitude": 46.3026,
    "provinceCode": "IL"
  },
  "Eyvan": {
    "latitude": 33.4974,
    "longitude": 46.3426,
    "provinceCode": "IL"
  },
  "Abdanan": {
    "latitude": 33.5324,
    "longitude": 46.3826,
    "provinceCode": "IL"
  },
  "Mehran": {
    "latitude": 33.5674,
    "longitude": 46.4226,
    "provinceCode": "IL"
  },
  "Darreh Shahr": {
    "latitude": 33.6024,
    "longitude": 46.4626,
    "provinceCode": "IL"
  },
  "Bushehr": {
    "latitude": 28.9234,
    "longitude": 50.8203,
    "provinceCode": "BU"
  },
  "Borazjan": {
    "latitude": 28.9584,
    "longitude": 50.9403,
    "provinceCode": "BU"
  },
  "Bandar Genaveh": {
    "latitude": 28.9934,
    "longitude": 50.9803,
    "provinceCode": "BU"
  },
  "Bandar Kangan": {
    "latitude": 29.0284,
    "longitude": 51.0203,
    "provinceCode": "BU"
  },
  "Asaluyeh": {
    "latitude": 29.0634,
    "longitude": 51.0603,
    "provinceCode": "BU"
  },
  "Khormuj": {
    "latitude": 29.0984,
    "longitude": 50.5803,
    "provinceCode": "BU"
  },
  "Dayyer": {
    "latitude": 29.1334,
    "longitude": 50.6203,
    "provinceCode": "BU"
  },
  "Yasuj": {
    "latitude": 30.6684,
    "longitude": 51.5879,
    "provinceCode": "KB"
  },
  "Dogonbadan": {
    "latitude": 30.9484,
    "longitude": 51.4679,
    "provinceCode": "KB"
  },
  "Dehdasht": {
    "latitude": 30.3884,
    "longitude": 51.5079,
    "provinceCode": "KB"
  },
  "Shahrekord": {
    "latitude": 32.3256,
    "longitude": 50.8644,
    "provinceCode": "CB"
  },
  "Borujen": {
    "latitude": 32.1156,
    "longitude": 50.8644,
    "provinceCode": "CB"
  },
  "Lordegan": {
    "latitude": 32.1506,
    "longitude": 50.9044,
    "provinceCode": "CB"
  },
  "Farrokhshahr": {
    "latitude": 32.1856,
    "longitude": 50.9444,
    "provinceCode": "CB"
  },
  "Farsan": {
    "latitude": 32.2206,
    "longitude": 50.9844,
    "provinceCode": "CB"
  },
  "Bojnurd": {
    "latitude": 37.475,
    "longitude": 57.3333,
    "provinceCode": "NK"
  },
  "Shirvan": {
    "latitude": 37.44,
    "longitude": 57.5333,
    "provinceCode": "NK"
  },
  "Esfarayen": {
    "latitude": 37.475,
    "longitude": 57.5733,
    "provinceCode": "NK"
  },
  "Jajarm": {
    "latitude": 37.51,
    "longitude": 57.0933,
    "provinceCode": "NK"
  },
  "Faruj": {
    "latitude": 37.545,
    "longitude": 57.1333,
    "provinceCode": "NK"
  },
  "Birjand": {
    "latitude": 32.8663,
    "longitude": 59.2211,
    "provinceCode": "SK"
  },
  "Qaen": {
    "latitude": 33.0063,
    "longitude": 59.1011,
    "provinceCode": "SK"
  },
  "Ferdows": {
    "latitude": 33.0413,
    "longitude": 59.1411,
    "provinceCode": "SK"
  },
  "Tabas": {
    "latitude": 33.0763,
    "longitude": 59.1811,
    "provinceCode": "SK"
  },
  "Nehbandan": {
    "latitude": 33.1113,
    "longitude": 59.2211,
    "provinceCode": "SK"
  },
  "Hashtgerd New Town": {
    "latitude": 36.12,
    "longitude": 50.9791,
    "provinceCode": "AL"
  },
  "Parand": {
    "latitude": 35.4092,
    "longitude": 51.469,
    "provinceCode": "TE"
  },
  "Andisheh": {
    "latitude": 35.4442,
    "longitude": 51.509,
    "provinceCode": "TE"
  },
  "Bumehen": {
    "latitude": 35.4792,
    "longitude": 51.549,
    "provinceCode": "TE"
  },
  "Javadabad": {
    "latitude": 35.5142,
    "longitude": 51.589,
    "provinceCode": "TE"
  },
  "Zarinshahr": {
    "latitude": 32.5146,
    "longitude": 51.908,
    "provinceCode": "IS"
  },
  "Dolatabad": {
    "latitude": 32.5496,
    "longitude": 51.428,
    "provinceCode": "IS"
  },
  "Khorasgan": {
    "latitude": 32.5846,
    "longitude": 51.468,
    "provinceCode": "IS"
  },
  "Chadegan": {
    "latitude": 32.6196,
    "longitude": 51.508,
    "provinceCode": "IS"
  },
  "Fereydunshahr": {
    "latitude": 32.6546,
    "longitude": 51.548,
    "provinceCode": "IS"
  },
  "Nurabad Mamasani": {
    "latitude": 29.6268,
    "longitude": 52.5037,
    "provinceCode": "FA"
  },
  "Sepidan": {
    "latitude": 29.6618,
    "longitude": 52.5437,
    "provinceCode": "FA"
  },
  "Zarqan": {
    "latitude": 29.6968,
    "longitude": 52.5837,
    "provinceCode": "FA"
  },
  "Kavar": {
    "latitude": 29.7318,
    "longitude": 52.6237,
    "provinceCode": "FA"
  },
  "Sarvestan": {
    "latitude": 29.7668,
    "longitude": 52.6637,
    "provinceCode": "FA"
  },
  "Fariman": {
    "latitude": 36.4705,
    "longitude": 59.7368,
    "provinceCode": "RK"
  },
  "Bardaskan": {
    "latitude": 36.5055,
    "longitude": 59.7768,
    "provinceCode": "RK"
  },
  "Khalilabad": {
    "latitude": 36.5405,
    "longitude": 59.8168,
    "provinceCode": "RK"
  },
  "Roshtkhar": {
    "latitude": 35.9805,
    "longitude": 59.8568,
    "provinceCode": "RK"
  },
  "Bajestan": {
    "latitude": 36.0155,
    "longitude": 59.3768,
    "provinceCode": "RK"
  },
  "Hendijan": {
    "latitude": 31.1083,
    "longitude": 48.4706,
    "provinceCode": "KZ"
  },
  "Shadegan": {
    "latitude": 31.1433,
    "longitude": 48.5106,
    "provinceCode": "KZ"
  },
  "Ramshir": {
    "latitude": 31.1783,
    "longitude": 48.5506,
    "provinceCode": "KZ"
  },
  "Haftkel": {
    "latitude": 31.2133,
    "longitude": 48.5906,
    "provinceCode": "KZ"
  },
  "Lali": {
    "latitude": 31.2483,
    "longitude": 48.6306,
    "provinceCode": "KZ"
  },
  "Freydunkenar": {
    "latitude": 36.5283,
    "longitude": 53.0601,
    "provinceCode": "MN"
  },
  "Kelarabad": {
    "latitude": 36.5633,
    "longitude": 53.1001,
    "provinceCode": "MN"
  },
  "Abbasabad": {
    "latitude": 36.5983,
    "longitude": 53.1401,
    "provinceCode": "MN"
  },
  "Galugah": {
    "latitude": 36.6333,
    "longitude": 53.1801,
    "provinceCode": "MN"
  },
  "Savadkuh": {
    "latitude": 36.6683,
    "longitude": 53.2201,
    "provinceCode": "MN"
  },
  "Masal": {
    "latitude": 37.4208,
    "longitude": 49.7832,
    "provinceCode": "GI"
  },
  "Rezvanshahr": {
    "latitude": 37.4558,
    "longitude": 49.8232,
    "provinceCode": "GI"
  },
  "Amlash": {
    "latitude": 37.4908,
    "longitude": 49.3432,
    "provinceCode": "GI"
  },
  "Siahkal": {
    "latitude": 37.5258,
    "longitude": 49.3832,
    "provinceCode": "GI"
  },
  "Kuchesfahan": {
    "latitude": 37.5608,
    "longitude": 49.4232,
    "provinceCode": "GI"
  },
  "Bardsir": {
    "latitude": 30.0039,
    "longitude": 56.9588,
    "provinceCode": "KE"
  },
  "Anbarabad": {
    "latitude": 30.0389,
    "longitude": 56.9988,
    "provinceCode": "KE"
  },
  "Manujan": {
    "latitude": 30.0739,
    "longitude": 57.0388,
    "provinceCode": "KE"
  },
  "Ravar": {
    "latitude": 30.1089,
    "longitude": 57.0788,
    "provinceCode": "KE"
  },
  "Fahraj": {
    "latitude": 30.1439,
    "longitude": 57.1188,
    "provinceCode": "KE"
  },
  "Pakdasht Industrial": {
    "latitude": 35.5842,
    "longitude": 51.469,
    "provinceCode": "TE"
  },
  "Shahriar Industrial": {
    "latitude": 35.6192,
    "longitude": 51.509,
    "provinceCode": "TE"
  },
  "Najafabad Industrial": {
    "latitude": 32.6196,
    "longitude": 51.828,
    "provinceCode": "IS"
  },
  "Mahshahr Port": {
    "latitude": 31.3183,
    "longitude": 48.8706,
    "provinceCode": "KZ"
  },
  "Bandar Imam Khomeini": {
    "latitude": 31.3533,
    "longitude": 48.9106,
    "provinceCode": "KZ"
  },
  "Asaluyeh Port": {
    "latitude": 28.9934,
    "longitude": 50.5803,
    "provinceCode": "BU"
  },
  "Chabahar Free Zone": {
    "latitude": 29.6013,
    "longitude": 60.6629,
    "provinceCode": "SB"
  },
  "Aras Free Zone": {
    "latitude": 38.2362,
    "longitude": 46.1138,
    "provinceCode": "EA"
  },
  "Anzali Free Zone": {
    "latitude": 37.4558,
    "longitude": 49.4632,
    "provinceCode": "GI"
  },
  "Qeshm Free Zone": {
    "latitude": 27.3932,
    "longitude": 56.1866,
    "provinceCode": "HG"
  },
  "Kish Free Zone": {
    "latitude": 27.4282,
    "longitude": 56.2266,
    "provinceCode": "HG"
  },
  "Eqlid": {
    "latitude": 29.8718,
    "longitude": 52.5837,
    "provinceCode": "FA"
  },
  "Pasargad": {
    "latitude": 29.3118,
    "longitude": 52.6237,
    "provinceCode": "FA"
  },
  "Khorrambid": {
    "latitude": 29.3468,
    "longitude": 52.6637,
    "provinceCode": "FA"
  },
  "Bavanat": {
    "latitude": 29.3818,
    "longitude": 52.7037,
    "provinceCode": "FA"
  },
  "Kharameh": {
    "latitude": 29.4168,
    "longitude": 52.7437,
    "provinceCode": "FA"
  },
  "Mahdasht": {
    "latitude": 35.7,
    "longitude": 51.1391,
    "provinceCode": "AL"
  },
  "Garmdareh": {
    "latitude": 35.735,
    "longitude": 51.1791,
    "provinceCode": "AL"
  },
  "Meshkin Dasht": {
    "latitude": 35.77,
    "longitude": 50.6991,
    "provinceCode": "AL"
  },
  "Kamalshahr": {
    "latitude": 35.805,
    "longitude": 50.7391,
    "provinceCode": "AL"
  },
  "Mohammadiyeh": {
    "latitude": 36.2688,
    "longitude": 49.8441,
    "provinceCode": "QZ"
  },
  "Eqbaliyeh": {
    "latitude": 36.3038,
    "longitude": 49.8841,
    "provinceCode": "QZ"
  },
  "Shal": {
    "latitude": 36.3388,
    "longitude": 49.9241,
    "provinceCode": "QZ"
  },
  "Avaj": {
    "latitude": 36.3738,
    "longitude": 49.9641,
    "provinceCode": "QZ"
  },
  "Damavand Absard": {
    "latitude": 35.8292,
    "longitude": 51.389,
    "provinceCode": "TE"
  },
  "Lavasan": {
    "latitude": 35.8642,
    "longitude": 51.429,
    "provinceCode": "TE"
  },
  "Rudehen": {
    "latitude": 35.8992,
    "longitude": 51.469,
    "provinceCode": "TE"
  },
  "Absard": {
    "latitude": 35.9342,
    "longitude": 51.509,
    "provinceCode": "TE"
  },
  "Qaemieh": {
    "latitude": 29.8718,
    "longitude": 52.7437,
    "provinceCode": "FA"
  },
  "Nurabad Lorestan": {
    "latitude": 33.2078,
    "longitude": 48.5558,
    "provinceCode": "LO"
  },
  "Aleshtar": {
    "latitude": 33.2428,
    "longitude": 48.5958,
    "provinceCode": "LO"
  },
  "Delfan": {
    "latitude": 33.2778,
    "longitude": 48.1158,
    "provinceCode": "LO"
  },
  "Selseleh": {
    "latitude": 33.3128,
    "longitude": 48.1558,
    "provinceCode": "LO"
  },
  "Bastak": {
    "latitude": 27.0432,
    "longitude": 56.1066,
    "provinceCode": "HG"
  },
  "Parsian": {
    "latitude": 27.0782,
    "longitude": 56.1466,
    "provinceCode": "HG"
  },
  "Jask": {
    "latitude": 27.1132,
    "longitude": 56.1866,
    "provinceCode": "HG"
  },
  "Sirik": {
    "latitude": 27.1482,
    "longitude": 56.2266,
    "provinceCode": "HG"
  },
  "Haji Abad Hormozgan": {
    "latitude": 27.1832,
    "longitude": 56.2666,
    "provinceCode": "HG"
  },
  "Nikshahr": {
    "latitude": 29.5313,
    "longitude": 60.9029,
    "provinceCode": "SB"
  },
  "Sarbaz": {
    "latitude": 29.5663,
    "longitude": 60.9429,
    "provinceCode": "SB"
  },
  "Mirjaveh": {
    "latitude": 29.6013,
    "longitude": 60.9829,
    "provinceCode": "SB"
  },
  "Dalgan": {
    "latitude": 29.6363,
    "longitude": 61.0229,
    "provinceCode": "SB"
  },
  "Fanuj": {
    "latitude": 29.6713,
    "longitude": 61.0629,
    "provinceCode": "SB"
  },
  "Nehbandan Shusf": {
    "latitude": 33.0763,
    "longitude": 59.4611,
    "provinceCode": "SK"
  },
  "Sarbisheh": {
    "latitude": 33.1113,
    "longitude": 58.9811,
    "provinceCode": "SK"
  },
  "Darmian": {
    "latitude": 33.1463,
    "longitude": 59.0211,
    "provinceCode": "SK"
  },
  "Zirkuh": {
    "latitude": 32.5863,
    "longitude": 59.0611,
    "provinceCode": "SK"
  },
  "Boshruyeh": {
    "latitude": 32.6213,
    "longitude": 59.1011,
    "provinceCode": "SK"
  },
  "Raz and Jargalan": {
    "latitude": 37.265,
    "longitude": 57.2533,
    "provinceCode": "NK"
  },
  "Garmeh": {
    "latitude": 37.3,
    "longitude": 57.2933,
    "provinceCode": "NK"
  },
  "Mana and Samalghan": {
    "latitude": 37.335,
    "longitude": 57.3333,
    "provinceCode": "NK"
  },
  "Joveyn": {
    "latitude": 36.1555,
    "longitude": 59.6568,
    "provinceCode": "RK"
  },
  "Joghatay": {
    "latitude": 36.1905,
    "longitude": 59.6968,
    "provinceCode": "RK"
  },
  "Firuzeh": {
    "latitude": 36.2255,
    "longitude": 59.7368,
    "provinceCode": "RK"
  },
  "Zaveh": {
    "latitude": 36.2605,
    "longitude": 59.7768,
    "provinceCode": "RK"
  },
  "Bakharz": {
    "latitude": 36.2955,
    "longitude": 59.8168,
    "provinceCode": "RK"
  },
  "Kalat": {
    "latitude": 36.3305,
    "longitude": 59.8568,
    "provinceCode": "RK"
  },
  "Dargaz Lotfabad": {
    "latitude": 36.3655,
    "longitude": 59.3768,
    "provinceCode": "RK"
  },
  "Marivan Kani Dinar": {
    "latitude": 35.4619,
    "longitude": 46.7862,
    "provinceCode": "KD"
  },
  "Saqqez Industrial": {
    "latitude": 35.4969,
    "longitude": 46.8262,
    "provinceCode": "KD"
  },
  "Dehgolan": {
    "latitude": 35.5319,
    "longitude": 46.8662,
    "provinceCode": "KD"
  },
  "Sarvabad": {
    "latitude": 35.5669,
    "longitude": 46.9062,
    "provinceCode": "KD"
  },
  "Zarrinabad": {
    "latitude": 36.9536,
    "longitude": 48.4387,
    "provinceCode": "ZN"
  },
  "Soltaniyeh": {
    "latitude": 36.3936,
    "longitude": 48.4787,
    "provinceCode": "ZN"
  },
  "Mahneshan": {
    "latitude": 36.4286,
    "longitude": 48.5187,
    "provinceCode": "ZN"
  },
  "Ijrud": {
    "latitude": 36.4636,
    "longitude": 48.5587,
    "provinceCode": "ZN"
  },
  "Hidaj": {
    "latitude": 36.4986,
    "longitude": 48.5987,
    "provinceCode": "ZN"
  },
  "Sorkheh": {
    "latitude": 35.4329,
    "longitude": 53.5571,
    "provinceCode": "SM"
  },
  "Aradan": {
    "latitude": 35.4679,
    "longitude": 53.5971,
    "provinceCode": "SM"
  },
  "Mayamey": {
    "latitude": 35.5029,
    "longitude": 53.6371,
    "provinceCode": "SM"
  },
  "Bastam": {
    "latitude": 35.5379,
    "longitude": 53.1571,
    "provinceCode": "SM"
  },
  "Shahmirzad": {
    "latitude": 35.5729,
    "longitude": 53.1971,
    "provinceCode": "SM"
  },
  "Azadshahr": {
    "latitude": 36.8806,
    "longitude": 54.2793,
    "provinceCode": "GO"
  },
  "Ramian": {
    "latitude": 36.9156,
    "longitude": 54.3193,
    "provinceCode": "GO"
  },
  "Galikash": {
    "latitude": 36.9506,
    "longitude": 54.3593,
    "provinceCode": "GO"
  },
  "Maraveh Tappeh": {
    "latitude": 36.9856,
    "longitude": 54.3993,
    "provinceCode": "GO"
  },
  "Bandar Gaz": {
    "latitude": 37.0206,
    "longitude": 54.4393,
    "provinceCode": "GO"
  },
  "Namin": {
    "latitude": 38.4598,
    "longitude": 48.3333,
    "provinceCode": "AR"
  },
  "Nir": {
    "latitude": 38.4948,
    "longitude": 48.3733,
    "provinceCode": "AR"
  },
  "Sareyn": {
    "latitude": 38.5298,
    "longitude": 48.4133,
    "provinceCode": "AR"
  },
  "Kowsar": {
    "latitude": 37.9698,
    "longitude": 48.4533,
    "provinceCode": "AR"
  },
  "Ungut": {
    "latitude": 38.0048,
    "longitude": 48.4933,
    "provinceCode": "AR"
  },
  "Eyvaneke": {
    "latitude": 35.3629,
    "longitude": 53.6371,
    "provinceCode": "SM"
  },
  "Pishva Varamin": {
    "latitude": 35.5142,
    "longitude": 51.149,
    "provinceCode": "TE"
  },
  "Qarchak": {
    "latitude": 35.5492,
    "longitude": 51.189,
    "provinceCode": "TE"
  },
  "Nasimshahr": {
    "latitude": 35.5842,
    "longitude": 51.229,
    "provinceCode": "TE"
  },
  "Salehieh": {
    "latitude": 35.6192,
    "longitude": 51.269,
    "provinceCode": "TE"
  },
  "Ferdowsieh": {
    "latitude": 35.6542,
    "longitude": 51.309,
    "provinceCode": "TE"
  },
  "Shahedshahr": {
    "latitude": 35.6892,
    "longitude": 51.349,
    "provinceCode": "TE"
  },
  "Sabashahr": {
    "latitude": 35.7242,
    "longitude": 51.389,
    "provinceCode": "TE"
  },
  "Vahidieh": {
    "latitude": 35.7592,
    "longitude": 51.429,
    "provinceCode": "TE"
  },
  "Baghersetan": {
    "latitude": 32.7596,
    "longitude": 51.748,
    "provinceCode": "IS"
  },
  "Dubai": {
    "latitude": 25.2048,
    "longitude": 55.2708,
    "provinceCode": "AE"
  }
} as const;
