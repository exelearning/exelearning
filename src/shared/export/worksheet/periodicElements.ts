/**
 * The periodic table, as the Periodic table activity knows it
 *
 * The activity stores which groups of elements are in play and how many to ask about, never which
 * ones: it draws them afresh on every load from a table that lives inside its own JavaScript. A
 * worksheet has to draw its own set, so the table comes here — ported from `elements_dataf`, entry
 * for entry.
 *
 * Only the chemistry is here. An element's name and the name of its group are the activity's own
 * words, kept in its payload under the keys below, so a project written in Spanish prints 'Hierro'
 * and 'Metal de transición' rather than a translation of our own.
 *
 * `electronegativity` is null for the four noble gases that have none, which is how the activity
 * stores it and what keeps an empty cell from reading as a zero.
 */

/** One element, with its name and group held as keys into the activity's own wording. */
export interface PeriodicElement {
    number: number;
    symbol: string;
    /** Key into the activity's `msgs` for this element's name. */
    nameKey: string;
    /** Key into the activity's `msgs` for the name of its group. */
    groupKey: string;
    mass: number;
    electronegativity: number | null;
    /** Oxidation states, comma-separated as the activity stores them. */
    oxidation: string;
    configuration: string;
}

/** Every element, in atomic number order, so `PERIODIC_ELEMENTS[n - 1]` is element n. */
export const PERIODIC_ELEMENTS: readonly PeriodicElement[] = [
    { number: 1, symbol: 'H', nameKey: 'Hydrogen', groupKey: 'msgNonMetal', mass: 1.00794, electronegativity: 2.2, oxidation: '+1,-1', configuration: '1s1' },
    { number: 2, symbol: 'He', nameKey: 'Helium', groupKey: 'msgNobleGas', mass: 4.0026, electronegativity: null, oxidation: '0', configuration: '1s2' },
    { number: 3, symbol: 'Li', nameKey: 'Lithium', groupKey: 'msgAlkaliMetal', mass: 6.941, electronegativity: 0.98, oxidation: '+1', configuration: '1s2 2s1' },
    { number: 4, symbol: 'Be', nameKey: 'Beryllium', groupKey: 'msgAlkalineEarthMetal', mass: 9.0122, electronegativity: 1.57, oxidation: '+2', configuration: '1s2 2s2' },
    { number: 5, symbol: 'B', nameKey: 'Boron', groupKey: 'msgMetalloid', mass: 10.81, electronegativity: 2.04, oxidation: '+3', configuration: '1s2 2s2 2p1' },
    { number: 6, symbol: 'C', nameKey: 'Carbon', groupKey: 'msgNonMetal', mass: 12.011, electronegativity: 2.55, oxidation: '+4,-4', configuration: '1s2 2s2 2p2' },
    { number: 7, symbol: 'N', nameKey: 'Nitrogen', groupKey: 'msgNonMetal', mass: 14.007, electronegativity: 3.04, oxidation: '+3,-3', configuration: '1s2 2s2 2p3' },
    { number: 8, symbol: 'O', nameKey: 'Oxygen', groupKey: 'msgNonMetal', mass: 15.999, electronegativity: 3.44, oxidation: '-2', configuration: '1s2 2s2 2p4' },
    { number: 9, symbol: 'F', nameKey: 'Fluorine', groupKey: 'msgHalogen', mass: 18.998, electronegativity: 3.98, oxidation: '-1', configuration: '1s2 2s2 2p5' },
    { number: 10, symbol: 'Ne', nameKey: 'Neon', groupKey: 'msgNobleGas', mass: 20.18, electronegativity: null, oxidation: '0', configuration: '1s2 2s2 2p6' },
    { number: 11, symbol: 'Na', nameKey: 'Sodium', groupKey: 'msgAlkaliMetal', mass: 22.99, electronegativity: 0.93, oxidation: '+1', configuration: '1s2 2s2 2p6 3s1' },
    { number: 12, symbol: 'Mg', nameKey: 'Magnesium', groupKey: 'msgAlkalineEarthMetal', mass: 24.305, electronegativity: 1.31, oxidation: '+2', configuration: '1s2 2s2 2p6 3s2' },
    { number: 13, symbol: 'Al', nameKey: 'Aluminum', groupKey: 'msgPostTransitionMetal', mass: 26.982, electronegativity: 1.61, oxidation: '+3', configuration: '1s2 2s2 2p6 3s2 3p1' },
    { number: 14, symbol: 'Si', nameKey: 'Silicon', groupKey: 'msgMetalloid', mass: 28.085, electronegativity: 1.9, oxidation: '+4,-4', configuration: '1s2 2s2 2p6 3s2 3p2' },
    { number: 15, symbol: 'P', nameKey: 'Phosphorus', groupKey: 'msgNonMetal', mass: 30.974, electronegativity: 2.19, oxidation: '+5,-3', configuration: '1s2 2s2 2p6 3s2 3p3' },
    { number: 16, symbol: 'S', nameKey: 'Sulfur', groupKey: 'msgNonMetal', mass: 32.065, electronegativity: 2.58, oxidation: '+6,-2', configuration: '1s2 2s2 2p6 3s2 3p4' },
    { number: 17, symbol: 'Cl', nameKey: 'Chlorine', groupKey: 'msgHalogen', mass: 35.45, electronegativity: 3.16, oxidation: '-1', configuration: '1s2 2s2 2p6 3s2 3p5' },
    { number: 18, symbol: 'Ar', nameKey: 'Argon', groupKey: 'msgNobleGas', mass: 39.948, electronegativity: null, oxidation: '0', configuration: '1s2 2s2 2p6 3s2 3p6' },
    { number: 19, symbol: 'K', nameKey: 'Potassium', groupKey: 'msgAlkaliMetal', mass: 39.098, electronegativity: 0.82, oxidation: '+1', configuration: '1s2 2s2 2p6 3s2 3p6 4s1' },
    { number: 20, symbol: 'Ca', nameKey: 'Calcium', groupKey: 'msgAlkalineEarthMetal', mass: 40.078, electronegativity: 1.0, oxidation: '+2', configuration: '1s2 2s2 2p6 3s2 3p6 4s2' },
    { number: 21, symbol: 'Sc', nameKey: 'Scandium', groupKey: 'msgTransitionMetal', mass: 44.956, electronegativity: 1.36, oxidation: '+3', configuration: '1s2 2s2 2p6 3s2 3p6 4s2 3d1' },
    { number: 22, symbol: 'Ti', nameKey: 'Titanium', groupKey: 'msgTransitionMetal', mass: 47.867, electronegativity: 1.54, oxidation: '+4,+3', configuration: '1s2 2s2 2p6 3s2 3p6 4s2 3d2' },
    { number: 23, symbol: 'V', nameKey: 'Vanadium', groupKey: 'msgTransitionMetal', mass: 50.9415, electronegativity: 1.63, oxidation: '+5, +4, +3, +2', configuration: '[Ar] 3d3 4s2' },
    { number: 24, symbol: 'Cr', nameKey: 'Chromium', groupKey: 'msgTransitionMetal', mass: 51.9961, electronegativity: 1.66, oxidation: '+6, +3, +2', configuration: '[Ar] 3d5 4s1' },
    { number: 25, symbol: 'Mn', nameKey: 'Manganese', groupKey: 'msgTransitionMetal', mass: 54.938, electronegativity: 1.55, oxidation: '+7, +6, +4, +3, +2', configuration: '[Ar] 3d5 4s2' },
    { number: 26, symbol: 'Fe', nameKey: 'Iron', groupKey: 'msgTransitionMetal', mass: 55.845, electronegativity: 1.83, oxidation: '+3,+2', configuration: '[Ar] 3d6 4s2' },
    { number: 27, symbol: 'Co', nameKey: 'Cobalt', groupKey: 'msgTransitionMetal', mass: 58.933, electronegativity: 1.88, oxidation: '+3,+2', configuration: '[Ar] 3d7 4s2' },
    { number: 28, symbol: 'Ni', nameKey: 'Nickel', groupKey: 'msgTransitionMetal', mass: 58.693, electronegativity: 1.91, oxidation: '+2,+3', configuration: '[Ar] 3d8 4s2' },
    { number: 29, symbol: 'Cu', nameKey: 'Copper', groupKey: 'msgTransitionMetal', mass: 63.546, electronegativity: 1.9, oxidation: '+2,+1', configuration: '[Ar] 3d10 4s1' },
    { number: 30, symbol: 'Zn', nameKey: 'Zinc', groupKey: 'msgTransitionMetal', mass: 65.38, electronegativity: 1.65, oxidation: '+2', configuration: '[Ar] 3d10 4s2' },
    { number: 31, symbol: 'Ga', nameKey: 'Galium', groupKey: 'msgPostTransitionMetal', mass: 69.723, electronegativity: 1.81, oxidation: '+3', configuration: '[Ar] 3d10 4s2 4p1' },
    { number: 32, symbol: 'Ge', nameKey: 'Germanium', groupKey: 'msgMetalloid', mass: 72.64, electronegativity: 2.01, oxidation: '+4,+2', configuration: '[Ar] 3d10 4s2 4p2' },
    { number: 33, symbol: 'As', nameKey: 'Arsenic', groupKey: 'msgMetalloid', mass: 74.922, electronegativity: 2.18, oxidation: '+3,-3', configuration: '[Ar] 3d10 4s2 4p3' },
    { number: 34, symbol: 'Se', nameKey: 'Selenium', groupKey: 'msgNonMetal', mass: 78.971, electronegativity: 2.55, oxidation: '-2,+4,+6', configuration: '[Ar] 3d10 4s2 4p4' },
    { number: 35, symbol: 'Br', nameKey: 'Bromine', groupKey: 'msgHalogen', mass: 79.904, electronegativity: 2.96, oxidation: '-1,+1,+3,+5,+7', configuration: '[Ar] 3d10 4s2 4p5' },
    { number: 36, symbol: 'Kr', nameKey: 'Krypton', groupKey: 'msgNobleGas', mass: 83.798, electronegativity: 3.0, oxidation: '0', configuration: '[Ar] 3d10 4s2 4p6' },
    { number: 37, symbol: 'Rb', nameKey: 'Rubidium', groupKey: 'msgAlkaliMetal', mass: 85.468, electronegativity: 0.82, oxidation: '+1', configuration: '[Kr] 5s1' },
    { number: 38, symbol: 'Sr', nameKey: 'Strontium', groupKey: 'msgAlkalineEarthMetal', mass: 87.62, electronegativity: 0.95, oxidation: '+2', configuration: '[Kr] 5s2' },
    { number: 39, symbol: 'Y', nameKey: 'Yttrium', groupKey: 'msgTransitionMetal', mass: 88.906, electronegativity: 1.22, oxidation: '+3', configuration: '[Kr] 5s2 4d1' },
    { number: 40, symbol: 'Zr', nameKey: 'Zirconium', groupKey: 'msgTransitionMetal', mass: 91.224, electronegativity: 1.33, oxidation: '+4', configuration: '[Kr] 5s2 4d2' },
    { number: 41, symbol: 'Nb', nameKey: 'Niobium', groupKey: 'msgTransitionMetal', mass: 92.906, electronegativity: 1.6, oxidation: '+5,+3', configuration: '[Kr] 5s1 4d4' },
    { number: 42, symbol: 'Mo', nameKey: 'Molybdenum', groupKey: 'msgTransitionMetal', mass: 95.95, electronegativity: 2.16, oxidation: '+6,+4,+3', configuration: '[Kr] 5s1 4d5' },
    { number: 43, symbol: 'Tc', nameKey: 'Technetium', groupKey: 'msgTransitionMetal', mass: 98, electronegativity: 1.9, oxidation: '+7,+4,+3', configuration: '[Kr] 5s2 4d5' },
    { number: 44, symbol: 'Ru', nameKey: 'Ruthenium', groupKey: 'msgTransitionMetal', mass: 101.07, electronegativity: 2.2, oxidation: '+8,+4,+3', configuration: '[Kr] 5s1 4d7' },
    { number: 45, symbol: 'Rh', nameKey: 'Rhodium', groupKey: 'msgTransitionMetal', mass: 102.91, electronegativity: 2.28, oxidation: '+3,+1', configuration: '[Kr] 5s1 4d8' },
    { number: 46, symbol: 'Pd', nameKey: 'Palladium', groupKey: 'msgTransitionMetal', mass: 106.42, electronegativity: 2.2, oxidation: '+2,+4', configuration: '[Kr] 5s0 4d10' },
    { number: 47, symbol: 'Ag', nameKey: 'Silver', groupKey: 'msgTransitionMetal', mass: 107.8682, electronegativity: 1.93, oxidation: '+1', configuration: '[Kr] 4d10 5s1' },
    { number: 48, symbol: 'Cd', nameKey: 'Cadmium', groupKey: 'msgTransitionMetal', mass: 112.411, electronegativity: 1.69, oxidation: '+2', configuration: '[Kr] 4d10 5s2' },
    { number: 49, symbol: 'In', nameKey: 'Indium', groupKey: 'msgPostTransitionMetal', mass: 114.818, electronegativity: 1.78, oxidation: '+3', configuration: '[Kr] 4d10 5s2 5p1' },
    { number: 50, symbol: 'Sn', nameKey: 'Tin', groupKey: 'msgPostTransitionMetal', mass: 118.71, electronegativity: 1.96, oxidation: '+4, +2', configuration: '[Kr] 4d10 5s2 5p2' },
    { number: 51, symbol: 'Sb', nameKey: 'Antimony', groupKey: 'msgMetalloid', mass: 121.76, electronegativity: 2.05, oxidation: '+3,-3', configuration: '[Kr] 5s2 4d10 5p3' },
    { number: 52, symbol: 'Te', nameKey: 'Tellurium', groupKey: 'msgMetalloid', mass: 127.6, electronegativity: 2.01, oxidation: '-2,+4,+6', configuration: '[Kr] 5s2 4d10 5p4' },
    { number: 53, symbol: 'I', nameKey: 'Iodine', groupKey: 'msgHalogen', mass: 126.904, electronegativity: 2.66, oxidation: '-1,+1,+3,+5,+7', configuration: '[Kr] 5s2 4d10 5p5' },
    { number: 54, symbol: 'Xe', nameKey: 'Xenon', groupKey: 'msgNobleGas', mass: 131.293, electronegativity: 2.6, oxidation: '0', configuration: '[Kr] 5s2 4d10 5p6' },
    { number: 55, symbol: 'Cs', nameKey: 'Cesium', groupKey: 'msgAlkaliMetal', mass: 132.91, electronegativity: 0.79, oxidation: '+1', configuration: '[Xe] 6s1' },
    { number: 56, symbol: 'Ba', nameKey: 'Barium', groupKey: 'msgAlkalineEarthMetal', mass: 137.33, electronegativity: 0.89, oxidation: '+2', configuration: '[Xe] 6s2' },
    { number: 57, symbol: 'La', nameKey: 'Lanthanum', groupKey: 'msgLanthanide', mass: 138.905, electronegativity: 1.1, oxidation: '+3', configuration: '[Xe] 5d1 6s2' },
    { number: 58, symbol: 'Ce', nameKey: 'Cerium', groupKey: 'msgLanthanide', mass: 140.12, electronegativity: 1.12, oxidation: '+4,+3', configuration: '[Xe] 4f1 5d1 6s2' },
    { number: 59, symbol: 'Pr', nameKey: 'Praseodymium', groupKey: 'msgLanthanide', mass: 140.907, electronegativity: 1.13, oxidation: '+3', configuration: '[Xe] 4f3 6s2' },
    { number: 60, symbol: 'Nd', nameKey: 'Neodymium', groupKey: 'msgLanthanide', mass: 144.24, electronegativity: 1.14, oxidation: '+3', configuration: '[Xe] 4f4 6s2' },
    { number: 61, symbol: 'Pm', nameKey: 'Promethium', groupKey: 'msgLanthanide', mass: 145, electronegativity: 1.13, oxidation: '+3', configuration: '[Xe] 4f5 6s2' },
    { number: 62, symbol: 'Sm', nameKey: 'Samarium', groupKey: 'msgLanthanide', mass: 150.36, electronegativity: 1.17, oxidation: '+3', configuration: '[Xe] 4f6 6s2' },
    { number: 63, symbol: 'Eu', nameKey: 'Europium', groupKey: 'msgLanthanide', mass: 151.98, electronegativity: 1.2, oxidation: '+3', configuration: '[Xe] 4f7 6s2' },
    { number: 64, symbol: 'Gd', nameKey: 'Gadolinium', groupKey: 'msgLanthanide', mass: 157.25, electronegativity: 1.2, oxidation: '+3', configuration: '[Xe] 4f7 5d1 6s2' },
    { number: 65, symbol: 'Tb', nameKey: 'Terbium', groupKey: 'msgLanthanide', mass: 158.93, electronegativity: 1.1, oxidation: '+3', configuration: '[Xe] 4f9 6s2' },
    { number: 66, symbol: 'Dy', nameKey: 'Dysprosium', groupKey: 'msgLanthanide', mass: 162.5, electronegativity: 1.22, oxidation: '+3', configuration: '[Xe] 4f10 6s2' },
    { number: 67, symbol: 'Ho', nameKey: 'Holmium', groupKey: 'msgLanthanide', mass: 164.93, electronegativity: 1.23, oxidation: '+3', configuration: '[Xe] 4f11 6s2' },
    { number: 68, symbol: 'Er', nameKey: 'Erbium', groupKey: 'msgLanthanide', mass: 167.26, electronegativity: 1.24, oxidation: '+3', configuration: '[Xe] 4f12 6s2' },
    { number: 69, symbol: 'Tm', nameKey: 'Thulium', groupKey: 'msgLanthanide', mass: 168.93, electronegativity: 1.25, oxidation: '+3', configuration: '[Xe] 4f13 6s2' },
    { number: 70, symbol: 'Yb', nameKey: 'Ytterbium', groupKey: 'msgLanthanide', mass: 173.04, electronegativity: 1.1, oxidation: '+3', configuration: '[Xe] 4f14 6s2' },
    { number: 71, symbol: 'Lu', nameKey: 'Lutetium', groupKey: 'msgLanthanide', mass: 175.0, electronegativity: 1.27, oxidation: '+3', configuration: '[Xe] 4f14 5d1 6s2' },
    { number: 72, symbol: 'Hf', nameKey: 'Hafnium', groupKey: 'msgTransitionMetal', mass: 178.49, electronegativity: 1.3, oxidation: '+4', configuration: '[Xe] 4f14 5d2 6s2' },
    { number: 73, symbol: 'Ta', nameKey: 'Tantalum', groupKey: 'msgTransitionMetal', mass: 180.95, electronegativity: 1.5, oxidation: '+5,+3', configuration: '[Xe] 4f14 5d3 6s2' },
    { number: 74, symbol: 'W', nameKey: 'Tungsten', groupKey: 'msgTransitionMetal', mass: 183.84, electronegativity: 2.36, oxidation: '+6, +5, +4, +3, +2, 0', configuration: '[Xe] 4f14 5d4 6s2' },
    { number: 75, symbol: 'Re', nameKey: 'Rhenium', groupKey: 'msgTransitionMetal', mass: 186.207, electronegativity: 1.9, oxidation: '+7, +6, +4, +2, -1', configuration: '[Xe] 4f14 5d5 6s2' },
    { number: 76, symbol: 'Os', nameKey: 'Osmium', groupKey: 'msgTransitionMetal', mass: 190.23, electronegativity: 2.2, oxidation: '+4,+3', configuration: '[Xe] 4f14 5d6 6s2' },
    { number: 77, symbol: 'Ir', nameKey: 'Iridium', groupKey: 'msgTransitionMetal', mass: 192.22, electronegativity: 2.2, oxidation: '+4,+3,+2', configuration: '[Xe] 4f14 5d7 6s2' },
    { number: 78, symbol: 'Pt', nameKey: 'Platinum', groupKey: 'msgTransitionMetal', mass: 195.08, electronegativity: 2.28, oxidation: '+4,+2', configuration: '[Xe] 4f14 5d9 6s1' },
    { number: 79, symbol: 'Au', nameKey: 'Gold', groupKey: 'msgTransitionMetal', mass: 196.967, electronegativity: 2.54, oxidation: '+3,+1', configuration: '[Xe] 4f14 5d10 6s1' },
    { number: 80, symbol: 'Hg', nameKey: 'Mercury', groupKey: 'msgTransitionMetal', mass: 200.59, electronegativity: 2.0, oxidation: '+2', configuration: '[Xe] 4f14 5d10 6s2' },
    { number: 81, symbol: 'Tl', nameKey: 'Thallium', groupKey: 'msgPostTransitionMetal', mass: 204.38, electronegativity: 1.62, oxidation: '+3,+1', configuration: '[Xe] 4f14 5d10 6s2 6p1' },
    { number: 82, symbol: 'Pb', nameKey: 'Lead', groupKey: 'msgPostTransitionMetal', mass: 207.2, electronegativity: 2.33, oxidation: '+4,+2', configuration: '[Xe] 4f14 5d10 6s2 6p2' },
    { number: 83, symbol: 'Bi', nameKey: 'Bismuth', groupKey: 'msgPostTransitionMetal', mass: 208.98, electronegativity: 2.02, oxidation: '+3,+5', configuration: '[Xe] 4f14 5d10 6s2 6p3' },
    { number: 84, symbol: 'Po', nameKey: 'Polonium', groupKey: 'msgMetalloid', mass: 209, electronegativity: 2.0, oxidation: '+2,+4', configuration: '[Xe] 4f14 5d10 6s2 6p4' },
    { number: 85, symbol: 'At', nameKey: 'Astatine', groupKey: 'msgHalogen', mass: 210, electronegativity: 2.2, oxidation: '+1,-1', configuration: '[Xe] 4f14 5d10 6s2 6p5' },
    { number: 86, symbol: 'Rn', nameKey: 'Radon', groupKey: 'msgNobleGas', mass: 222, electronegativity: null, oxidation: '0', configuration: '[Xe] 4f14 5d10 6s2 6p6' },
    { number: 87, symbol: 'Fr', nameKey: 'Francium', groupKey: 'msgAlkaliMetal', mass: 223, electronegativity: 0.7, oxidation: '+1', configuration: '[Rn] 7s1' },
    { number: 88, symbol: 'Ra', nameKey: 'Radium', groupKey: 'msgAlkalineEarthMetal', mass: 226, electronegativity: 0.9, oxidation: '+2', configuration: '[Rn] 7s2' },
    { number: 89, symbol: 'Ac', nameKey: 'Actinium', groupKey: 'msgActinide', mass: 227, electronegativity: 1.1, oxidation: '+3', configuration: '[Rn] 6d1 7s2' },
    { number: 90, symbol: 'Th', nameKey: 'Thorium', groupKey: 'msgActinide', mass: 232.04, electronegativity: 1.3, oxidation: '+4', configuration: '[Rn] 6d2 7s2' },
    { number: 91, symbol: 'Pa', nameKey: 'Protactinium', groupKey: 'msgActinide', mass: 231.04, electronegativity: 1.5, oxidation: '+5', configuration: '[Rn] 5f2 6d1 7s2' },
    { number: 92, symbol: 'U', nameKey: 'Uranium', groupKey: 'msgActinide', mass: 238.03, electronegativity: 1.38, oxidation: '+6,+4,+3', configuration: '[Rn] 5f3 6d1 7s2' },
    { number: 93, symbol: 'Np', nameKey: 'Neptunium', groupKey: 'msgActinide', mass: 237, electronegativity: 1.36, oxidation: '+5', configuration: '[Rn] 5f4 6d1 7s2' },
    { number: 94, symbol: 'Pu', nameKey: 'Plutonium', groupKey: 'msgActinide', mass: 244, electronegativity: 1.38, oxidation: '+6,+4', configuration: '[Rn] 5f6 6d1 7s2' },
    { number: 95, symbol: 'Am', nameKey: 'Americium', groupKey: 'msgActinide', mass: 243, electronegativity: 1.3, oxidation: '+3,+6', configuration: '[Rn] 5f7 6d1 7s2' },
    { number: 96, symbol: 'Cm', nameKey: 'Curium', groupKey: 'msgActinide', mass: 247, electronegativity: 1.3, oxidation: '+3', configuration: '[Rn] 5f7 6d1 7s2' },
    { number: 97, symbol: 'Bk', nameKey: 'Berkelium', groupKey: 'msgActinide', mass: 247, electronegativity: 1.3, oxidation: '+4, +3', configuration: '[Rn] 5f9 7s2' },
    { number: 98, symbol: 'Cf', nameKey: 'Californium', groupKey: 'msgActinide', mass: 251, electronegativity: 1.3, oxidation: '+3, +2', configuration: '[Rn] 5f10 7s2' },
    { number: 99, symbol: 'Es', nameKey: 'Einsteinium', groupKey: 'msgActinide', mass: 252, electronegativity: 1.3, oxidation: '+3, +2', configuration: '[Rn] 5f11 7s2' },
    { number: 100, symbol: 'Fm', nameKey: 'Fermium', groupKey: 'msgActinide', mass: 257, electronegativity: 1.3, oxidation: '+3, +2', configuration: '[Rn] 5f12 7s2' },
    { number: 101, symbol: 'Md', nameKey: 'Mendelevium', groupKey: 'msgActinide', mass: 258, electronegativity: 1.3, oxidation: '+3, +2', configuration: '[Rn] 5f13 7s2' },
    { number: 102, symbol: 'No', nameKey: 'Nobelium', groupKey: 'msgActinide', mass: 259, electronegativity: 1.3, oxidation: '+3', configuration: '[Rn] 5f14 6d1 7s2' },
    { number: 103, symbol: 'Lr', nameKey: 'Lawrencium', groupKey: 'msgActinide', mass: 262, electronegativity: 1.3, oxidation: '+3', configuration: '[Rn] 5f14 6d1 7s2' },
    { number: 104, symbol: 'Rf', nameKey: 'Rutherfordium', groupKey: 'msgTransitionMetal', mass: 267, electronegativity: 1.3, oxidation: '+4', configuration: '[Rn] 5f14 6d2 7s2' },
    { number: 105, symbol: 'Db', nameKey: 'Dubnium', groupKey: 'msgTransitionMetal', mass: 270, electronegativity: 1.3, oxidation: '+5', configuration: '[Rn] 5f14 6d3 7s2' },
    { number: 106, symbol: 'Sg', nameKey: 'Seaborgium', groupKey: 'msgTransitionMetal', mass: 271, electronegativity: 1.3, oxidation: '+6', configuration: '[Rn] 5f14 6d4 7s2' },
    { number: 107, symbol: 'Bh', nameKey: 'Bohrium', groupKey: 'msgTransitionMetal', mass: 270, electronegativity: 1.3, oxidation: '+7', configuration: '[Rn] 5f14 6d5 7s2' },
    { number: 108, symbol: 'Hs', nameKey: 'Hassium', groupKey: 'msgTransitionMetal', mass: 277, electronegativity: 1.3, oxidation: '+7', configuration: '[Rn] 5f14 6d6 7s2' },
    { number: 109, symbol: 'Mt', nameKey: 'Meitnerium', groupKey: 'msgTransitionMetal', mass: 278, electronegativity: 1.3, oxidation: '+7', configuration: '[Rn] 5f14 6d7 7s2' },
    { number: 110, symbol: 'Ds', nameKey: 'Darmstadtium', groupKey: 'msgTransitionMetal', mass: 281, electronegativity: 1.3, oxidation: '+8', configuration: '[Rn] 5f14 6d8 7s2' },
    { number: 111, symbol: 'Rg', nameKey: 'Roentgenium', groupKey: 'msgTransitionMetal', mass: 280, electronegativity: 1.3, oxidation: '+1', configuration: '[Rn] 5f14 6d9 7s2' },
    { number: 112, symbol: 'Cn', nameKey: 'Copernicium', groupKey: 'msgTransitionMetal', mass: 285, electronegativity: 1.3, oxidation: '+2', configuration: '[Rn] 5f14 6d10 7s2' },
    { number: 113, symbol: 'Nh', nameKey: 'Nihonium', groupKey: 'msgPostTransitionMetal', mass: 284, electronegativity: 1.3, oxidation: '+3', configuration: '[Rn] 5f14 6d10 7p1' },
    { number: 114, symbol: 'Fl', nameKey: 'Flerovium', groupKey: 'msgPostTransitionMetal', mass: 289, electronegativity: 1.3, oxidation: '+4', configuration: '[Rn] 5f14 6d10 7p2' },
    { number: 115, symbol: 'Mc', nameKey: 'Moscovium', groupKey: 'msgPostTransitionMetal', mass: 288, electronegativity: 1.3, oxidation: '+3', configuration: '[Rn] 5f14 6d10 7p3' },
    { number: 116, symbol: 'Lv', nameKey: 'Livermorium', groupKey: 'msgPostTransitionMetal', mass: 293, electronegativity: 1.3, oxidation: '+3', configuration: '[Rn] 5f14 6d10 7p4' },
    { number: 117, symbol: 'Ts', nameKey: 'Tennessine', groupKey: 'msgHalogen', mass: 294, electronegativity: 1.3, oxidation: '+1', configuration: '[Rn] 5f14 6d10 7p5' },
    { number: 118, symbol: 'Og', nameKey: 'Oganesson', groupKey: 'msgNobleGas', mass: 294, electronegativity: 1.3, oxidation: '0', configuration: '[Rn] 5f14 6d10 7p6' },
];

/**
 * The groups of elements the author can switch on, in the order their stored flags index them.
 *
 * `groups` in the payload is one flag per entry here, so the order is part of the format and not
 * something to tidy.
 */
export const PERIODIC_GROUPS: readonly { readonly name: string; readonly numbers: readonly number[] }[] = [
    { name: 'Alkali Metals', numbers: [3, 11, 19, 37, 55, 87] },
    { name: 'Alkaline Earth Metals', numbers: [4, 12, 20, 38, 56, 88] },
    { name: 'Transition Metals', numbers: [21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 72, 73, 74, 75, 76, 77, 78, 79, 80, 104, 105, 106, 107, 108, 109, 110, 111, 112] },
    { name: 'Post-Transition Metals', numbers: [13, 31, 49, 50, 81, 82, 83, 113, 114, 115, 116] },
    { name: 'Metalloids', numbers: [5, 14, 32, 33, 51, 52, 84] },
    { name: 'Non-Metals', numbers: [1, 6, 7, 8, 15, 16, 34] },
    { name: 'Halogens', numbers: [9, 17, 35, 53, 85, 117] },
    { name: 'Noble Gases', numbers: [2, 10, 18, 36, 54, 86, 118] },
    { name: 'Lanthanides', numbers: [57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71] },
    { name: 'Actinides', numbers: [89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103] },
];
