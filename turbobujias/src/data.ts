export interface Product {
  id: string;
  internalId?: string; // Database document ID
  name: string;
  brand: string;
  category: 'Spark Plug' | 'Heater' | 'Filter' | 'Other';
  price: number;
  image: string;
  description: string;
  specs: Record<string, string>;
  stock: number;
  oeReference?: string;
  upc?: string;
  ean?: string;
  oemNumbers?: string[];
  tags?: string[];
}

export interface Customer {
  id: string; // Firebase Auth UID
  name: string;
  email: string;
  vehicleInfo?: string;
  purchaseHistory?: string[]; // Array of product IDs
  updatedAt: any; // Firestore Timestamp
}

export interface LearningDoc {
  id?: string;
  source: string; // e.g., filename, URL
  content: string; // The text content learned
  timestamp: any; // Firestore Timestamp
}

export const PRODUCTS: Product[] = [
  {
    id: 'bkr6eix-11',
    name: 'NGK Iridium IX',
    brand: 'NGK',
    category: 'Spark Plug',
    price: 12.50,
    image: 'https://images.unsplash.com/photo-1621905235277-f2742407637f?auto=format&fit=crop&q=80&w=800',
    description: 'High performance iridium spark plug designed for improved throttle response and superior fouling resistance.',
    specs: {
      'Thread Size': '14mm',
      'Reach': '19mm',
      'Hex Size': '16mm',
      'Gap': '1.1mm',
      'Material': 'Iridium'
    },
    stock: 45,
    upc: '087295137590',
    ean: '0087295137590',
    oemNumbers: ['MZ603413', 'MN119487']
  },
  {
    id: 'itv22',
    name: 'Denso Iridium Power',
    brand: 'Denso',
    category: 'Spark Plug',
    price: 14.20,
    image: 'https://images.unsplash.com/photo-1635843472091-a9689255ec03?auto=format&fit=crop&q=80&w=800',
    description: 'Worlds smallest 0.4mm iridium center electrode for maximized firing potential.',
    specs: {
      'Thread Size': '14mm',
      'Reach': '25mm',
      'Hex Size': '16mm',
      'Gap': '0.8mm',
      'Material': 'Iridium'
    },
    stock: 30,
    upc: '042511053046',
    ean: '0042511053046',
    oemNumbers: ['L3Y218110', 'ZJ2018110']
  },
  {
    id: 'bosch-hr7dpp+',
    name: 'Bosch Double Platinum',
    brand: 'Bosch',
    category: 'Spark Plug',
    price: 9.99,
    image: 'https://images.unsplash.com/photo-1486006920555-c77dcf18193c?auto=format&fit=crop&q=80&w=800',
    description: 'Double platinum firing pin and ground electrode inlay for long service life.',
    specs: {
      'Thread Size': '14mm',
      'Reach': '19mm',
      'Hex Size': '16mm',
      'Material': 'Double Platinum'
    },
    stock: 50,
    upc: '028851441457',
    oemNumbers: ['0041591303', '0041595003']
  },
  {
    id: 'xp5325',
    name: 'Autolite Iridium XP',
    brand: 'Autolite',
    category: 'Spark Plug',
    price: 8.75,
    image: 'https://images.unsplash.com/photo-1590674899484-d5640e854abe?auto=format&fit=crop&q=80&w=800',
    description: 'One of the best values in iridium technology. Better durability and more focused ignition.',
    specs: {
      'Thread Size': '14mm',
      'Reach': '26.5mm',
      'Hex Size': '16mm',
      'Gap': '1.3mm'
    },
    stock: 65,
    upc: '009100053254',
    oemNumbers: ['SP-514', 'SP-541']
  },
  {
    id: 'diesel-heater-1',
    name: 'Glow Plug SV-10',
    brand: 'Denso',
    category: 'Heater',
    price: 25.00,
    image: 'https://images.unsplash.com/photo-1530046339160-ce3e5b0c7a2f?auto=format&fit=crop&q=80&w=800',
    description: 'High-quality diesel heater for quick starting even in cold temperatures.',
    specs: {
      'Voltage': '11V',
      'Thread Size': 'M10x1.0',
      'Overall Length': '103mm'
    },
    stock: 12,
    upc: '042511062017',
    oemNumbers: ['0011592601', '0011594901']
  },
  {
    id: 'cummins-injector',
    name: 'Fuel Injector Nozzle',
    brand: 'Cummins',
    category: 'Other',
    price: 145.00,
    image: 'https://images.unsplash.com/photo-1542362567-b052ea1321c1?auto=format&fit=crop&q=80&w=800',
    description: 'Genuine Cummins replacement injector nozzle for heavy-duty diesel engines.',
    specs: {
      'Model': '6BT / 4BT',
      'Type': 'Direct Injection',
      'Pressure': '245 Bar'
    },
    stock: 8,
    upc: '042100098765',
    oemNumbers: ['3919350', '3919339']
  },
  {
    id: 'champion-copper',
    name: 'Champion Copper Plus',
    brand: 'Champion',
    category: 'Spark Plug',
    price: 3.50,
    image: 'https://images.unsplash.com/photo-1621905235277-f2742407637f?auto=format&fit=crop&q=80&w=800',
    description: 'Traditional copper core spark plug. Reliable and cost-effective.',
    specs: {
      'Thread Size': '14mm',
      'Reach': '19mm',
      'Hex Size': '21mm',
      'Material': 'Copper'
    },
    stock: 120,
    upc: '037551000018',
    oemNumbers: ['RC12YC', 'OE001']
  },
  {
    id: 'MLV961793626',
    name: 'Bujias Ngk Br9es 5722 Motos Nautica Frias',
    brand: 'NGK',
    category: 'Spark Plug',
    price: 8.50,
    image: 'https://images.unsplash.com/photo-1635843472091-a9689255ec03?auto=format&fit=crop&q=80&w=800',
    description: 'Bujía NGK de alta calidad para motocicletas y náutica. Grado térmico frío.',
    specs: {
      'SKU': 'BR9ES',
      'Stock Number': '5722',
      'Weight': '0.2kg'
    },
    stock: 25,
    oeReference: 'BR9ES'
  },
  {
    id: 'MLV860532512',
    name: 'Bujia Denso Iridium Long Life Ztj16r10 5090 Silverado Hummer',
    brand: 'Denso',
    category: 'Spark Plug',
    price: 18.25,
    image: 'https://images.unsplash.com/photo-1590674899484-d5640e854abe?auto=format&fit=crop&q=80&w=800',
    description: 'Premium Long Life Iridium spark plug for Silverado and Hummer models.',
    specs: {
      'SKU': 'ZTJ16R10',
      'Stock Number': '5090',
      'Weight': '0.1kg'
    },
    stock: 12,
    oeReference: 'ZTJ16R10'
  },
  {
    id: 'MLV854668572',
    name: 'Bujia Msd Iridium 9i5y 37304',
    brand: 'MSD',
    category: 'Spark Plug',
    price: 15.00,
    image: 'https://images.unsplash.com/photo-1486006920555-c77dcf18193c?auto=format&fit=crop&q=80&w=800',
    description: 'High performance MSD Iridium spark plug for racing and performance applications.',
    specs: {
      'SKU': '9IR5Y',
      'Stock Number': '37304',
      'Weight': '0.1kg'
    },
    stock: 15,
    oeReference: '9IR5Y'
  },
  {
    id: 'MLV818620076',
    name: 'Bujias Ngk Bpmr7a 6703 Motores Pequeños',
    brand: 'NGK',
    category: 'Spark Plug',
    price: 6.20,
    image: 'https://images.unsplash.com/photo-1621905235277-f2742407637f?auto=format&fit=crop&q=80&w=800',
    description: 'Ideal para desmalezadoras, motosierras y motores pequeños.',
    specs: {
      'SKU': 'Bpmr7a',
      'Stock Number': '6703',
      'Weight': '0.1kg'
    },
    stock: 50,
    oeReference: 'BPMR7A'
  },
  {
    id: 'MLV818096360',
    name: 'Bujia Ngk Iridium Lkar7bix-11 93501 Toy Corolla Yaris Cross',
    brand: 'NGK',
    category: 'Spark Plug',
    price: 14.50,
    image: 'https://images.unsplash.com/photo-1590674899484-d5640e854abe?auto=format&fit=crop&q=80&w=800',
    description: 'Original equipment upgrade for Toyota Corolla, Yaris and Cross models.',
    specs: {
      'SKU': 'LKAR7BIX-11',
      'Stock Number': '93501',
      'Weight': '0.1kg'
    },
    stock: 20,
    oeReference: 'LKAR7BIX-11'
  },
  {
    id: 'oil-filter-22',
    name: 'Synthetic Oil Filter',
    brand: 'Fram',
    category: 'Filter',
    price: 18.50,
    image: 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&q=80&w=800',
    description: 'Premium synthetic media for maximum engine protection.',
    specs: {
      'Efficiency': '99% @ 20 microns',
      'Capacity': '15,000 miles',
      'Anti-Drain Valve': 'Silicone'
    },
    stock: 100,
    upc: '009100073177',
    oemNumbers: ['PH7317', 'TG7317']
  }
];
