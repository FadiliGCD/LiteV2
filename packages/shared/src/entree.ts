export type Emballage = "Carton" | "Plastic" | "Vrac" | "Frais";

// ✅ rename Code_Prd -> Code_Prp
export type CodePrp = "KATASAB" | "SESAMARINE" | "YOUSSEF" | "EL LEON";

// Keep old names as aliases (so nothing else breaks)
export type CodePrd = CodePrp;

export type Produit =
  | "Sardine_EEE"
  | "Sardine_Entier"
  | "Maquereau_Entier"
  | "Maquereau_EEE"
  | "Chinchard_Entier"
  | "Bonito_Entier"
  | "Mulet_Entier"
  | "Faux_Pêche";

export type Qualite =
  | "Autre"
  | "Entier"
  | "EE"
  | "A+"
  | "A-"
  | "nan"
  | "C"
  | "Animal"
  | "2ch"
  | "D"
  | "A"
  | "B";

export const CODE_PRP_OPTIONS: CodePrp[] = ["KATASAB", "SESAMARINE", "YOUSSEF", "EL LEON"];
export const CODE_PRD_OPTIONS = CODE_PRP_OPTIONS; // alias

export const PRODUIT_OPTIONS: Produit[] = [
  "Sardine_EEE",
  "Sardine_Entier",
  "Maquereau_Entier",
  "Maquereau_EEE",
  "Chinchard_Entier",
  "Bonito_Entier",
  "Mulet_Entier",
  "Faux_Pêche",
];

export const QUALITE_OPTIONS: Qualite[] = [
  "Autre",
  "Entier",
  "EE",
  "A+",
  "A-",
  "nan",
  "C",
  "Animal",
  "2ch",
  "D",
  "A",
  "B",
];

export const EMBALLAGE_OPTIONS: Emballage[] = ["Carton", "Plastic", "Vrac", "Frais"];

export const CALIBRE_BY_PRODUIT: Record<Produit, string[]> = {
  Sardine_Entier: ["16 PPk -", "16 PPk +", "Mixte"],
  Sardine_EEE: [
    "L07.5","L08.0","L08.3","L08.5","L08.6","L08.8","L09.0","L09.2","L09.3",
    "L09.4","L09.5","L09.6","L09.8","L10.0","L10.2","L10.3","L10.4","L10.5",
    "L10.6","L10.7","L11.0","Mixte"
  ],
  Maquereau_EEE: [
    "L07.5","L08.0","L08.3","L08.5","L08.6","L08.8","L09.0","L09.2","L09.3",
    "L09.4","L09.5","L09.6","L09.8","L10.0","L10.2","L10.3","L10.4","L10.5",
    "L10.6","L10.7","L11.0","Mixte"
  ],
  Bonito_Entier: ["1-2KG", "1-3KG", "Mixte"],
  Chinchard_Entier: ["L", "M", "S", "SS", "Mixte"],
  Maquereau_Entier: ["L", "M", "S", "SS", "Mixte"],
  Mulet_Entier: ["1-2KG", "1-3KG", "Mixte"],
  Faux_Pêche: ["Mixte"]
};
