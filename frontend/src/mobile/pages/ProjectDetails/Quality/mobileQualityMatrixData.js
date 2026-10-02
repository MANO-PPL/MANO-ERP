// This is the same local sample content used by the desktop QualityMatrix.
// It intentionally has no API or persistence contract.
export const QUALITY_MATRIX_INITIAL_DATA = Object.freeze([
    { id: 'cat_a', type: 'category', code: 'A', title: 'Civil Works' },
    { id: 'mat_1', type: 'material', categoryId: 'cat_a', code: '1', title: 'Ordinary Portland Cement', subtitle: '43 grade or 53 Grade', reference: 'IS 8112 / IS 12269', remarks: 'Sample test certificates to be maintained at site lab.', tests: [
        { id: 't1_1', name: 'Physical - Setting time (Initial)', result: 'Not less than 30 min', interval: '5000 bags or change of brand' },
        { id: 't1_2', name: 'Physical - Setting time (Final)', result: 'not more than 600 min', interval: '' },
        { id: 't1_3', name: 'Fineness', result: 'not more than 10% of weight pass through 90 micron sieve', interval: '' },
        { id: 't1_4', name: 'Compressive strength at 28 days', result: 'should be more than 43N/mm² and 53N/mm² respectively for 43 and 53 grade cement', interval: '' },
        { id: 't1_5', name: 'Chemical Composition', result: 'As per manufacturer test report', interval: '' },
    ] },
    { id: 'mat_2', type: 'material', categoryId: 'cat_a', code: '2', title: 'R/F Steel', subtitle: '[Fe 415 / Fe 500]', reference: 'IS 1786', remarks: 'Check for manufacturer logo & grade embossing on bars.', tests: [
        { id: 't2_1', name: 'Physical - % Elongation', result: 'Min 14.5%', interval: 'Each lot' },
        { id: 't2_2', name: 'Physical - Proof strength', result: '415 N/mm²', interval: '' },
        { id: 't2_3', name: 'Physical - Ultimate strength', result: '485 N/mm²', interval: '' },
        { id: 't2_4', name: 'Physical - Unit weight', result: 'as per IS 1786 table 3', interval: '' },
        { id: 't2_5', name: 'Physical - Rolling margin', result: 'Within permissible limit as per IS code', interval: '' },
        { id: 't2_6', name: 'Chemical composition', result: 'As per manufacturer test report', interval: '' },
    ] },
    { id: 'mat_3', type: 'material', categoryId: 'cat_a', code: '3', title: 'Soil for backfilling', subtitle: '', reference: 'IS 2720', remarks: 'Free from organic matter, roots, and debris.', tests: [
        { id: 't3_1', name: 'Maximum dry density & Optimum Moisture content', result: 'As per IS 2720', interval: 'Each source or change of soil type from each borrow pit' },
        { id: 't3_2', name: 'Field dry density per each layer of filling', result: 'minimum 90 to 95 % of MDD', interval: 'Each layer of filling and compaction' },
    ] },
    { id: 'mat_4', type: 'material', categoryId: 'cat_a', code: '4', title: 'Fine aggregate', subtitle: '', reference: 'IS 383', remarks: 'Washed sand required if silt content exceeds 8%.', tests: [
        { id: 't4_1', name: 'Sieve analysis', result: 'should conform to zone 1 or 2', interval: 'every 200M3 or change of source' },
        { id: 't4_2', name: 'Silt content', result: 'Max 8% by volume', interval: '' },
        { id: 't4_3', name: 'Specific gravity', result: '2.6 to 2.8 (once for each source)', interval: '' },
    ] },
    { id: 'mat_15', type: 'material_group', categoryId: 'cat_a', code: '15', title: 'Flooring Materials', hasSubdivisions: true, subdivisions: [
        { id: 'sub_15a', code: 'a', title: 'Kota / Jaisalmer / Cuddapa / Shahabad / Granite', reference: 'Physical inspection report to be maintained', remarks: 'Check edges for chipping and uniformity of shade.', tests: [{ id: 't15a_1', name: 'Visual Inspection for shades, thickness, colour & Cracks', result: 'As per BOQ', interval: 'Each Lot' }] },
        { id: 'sub_15b', code: 'b', title: 'Ceramic / Vitrified', reference: 'Physical inspection report to be maintained', remarks: 'Verify water absorption test as per manufacturer spec.', tests: [{ id: 't15b_1', name: 'Visual Inspection for shades, thickness, colour & Cracks', result: 'As per BOQ / Approved Mock up', interval: 'Each Lot' }] },
    ] },
]);

export const cloneQualityMatrix = () => JSON.parse(JSON.stringify(QUALITY_MATRIX_INITIAL_DATA));
