// Istanbul Airport Land Reclamation Analysis
// This script analyzes land changes between 2012 (pre-construction) and 2024 (post-construction)
// using Landsat imagery and NDWI water index

// Define study area
var airport = ee.Geometry.Point([28.7514, 41.2615]);
var ROI = airport.buffer(6000).bounds();

Map.centerObject(airport, 11);
Map.addLayer(ee.Image().paint(ROI, 0, 2), {palette: 'red'}, 'ROI');

// Load Landsat 5 imagery (2012 - pre-construction)
var landsat2012 = ee.ImageCollection("LANDSAT/LT05/C02/T1_L2")
  .filterBounds(ROI)
  .filterDate('2011-01-01', '2012-12-31')
  .filter(ee.Filter.lt('CLOUD_COVER', 50));

var image_2012 = landsat2012.sort('CLOUD_COVER').first();

// Load Landsat 9 imagery (2024 - post-construction)
var landsat2024 = ee.ImageCollection("LANDSAT/LC09/C02/T1_L2")
  .filterBounds(ROI)
  .filterDate('2023-01-01', '2024-12-31')
  .filter(ee.Filter.lt('CLOUD_COVER', 50));

var image_2024 = landsat2024.sort('CLOUD_COVER').first();

// Visualize true color
var vis_2012 = {bands: ['SR_B3', 'SR_B2', 'SR_B1'], min: 7000, max: 15000};
var vis_2024 = {bands: ['SR_B4', 'SR_B3', 'SR_B2'], min: 7000, max: 15000};

Map.addLayer(image_2012.clip(ROI), vis_2012, 'True Color 2012');
Map.addLayer(image_2024.clip(ROI), vis_2024, 'True Color 2024');

// Function to add NDWI band to Landsat 5
var addNDWI_L5 = function(image){
  var ndwi = image.normalizedDifference(['SR_B2', 'SR_B4']);
  ndwi = ndwi.select(['nd'], ['NDWI']);
  return image.addBands(ndwi);
};

// Function to add NDWI band to Landsat 9
var addNDWI_L9 = function(image){
  var ndwi = image.normalizedDifference(['SR_B3', 'SR_B5']);
  ndwi = ndwi.select(['nd'], ['NDWI']);
  return image.addBands(ndwi);
};

// Apply NDWI functions
image_2012 = addNDWI_L5(image_2012);
image_2024 = addNDWI_L9(image_2024);

// Visualize NDWI
var ndwiVis = {min: -0.5, max: 0.5, palette: ['8B4513', 'DEB887', 'FFFFFF', '87CEEB', '0000CD']};
Map.addLayer(image_2012.select('NDWI').clip(ROI), ndwiVis, 'NDWI 2012');
Map.addLayer(image_2024.select('NDWI').clip(ROI), ndwiVis, 'NDWI 2024');

// Classify water (NDWI > 0)
var water_2012 = image_2012.select('NDWI').gt(0);
var water_2024 = image_2024.select('NDWI').gt(0);

var waterVis = {min: 0, max: 1, palette: ['F5F5DC', '00008B']};
Map.addLayer(water_2012.clip(ROI), waterVis, 'Water 2012');
Map.addLayer(water_2024.clip(ROI), waterVis, 'Water 2024');

// Calculate land reclamation
var land_reclaimed = water_2012.subtract(water_2024).gt(0);

var reclaimedVis = {min: 0, max: 1, palette: ['FFFFFF', 'FF0000']};
Map.addLayer(land_reclaimed.clip(ROI), reclaimedVis, 'Land Reclaimed');

// ========== EXPORT IMAGES ==========

var exportROI = airport.buffer(7000).bounds();

// Export True Color 2012
Export.image.toDrive({
  image: image_2012.visualize(vis_2012).clip(exportROI),
  description: 'Istanbul_TrueColor_2012',
  scale: 30,
  region: exportROI,
  maxPixels: 1e13
});

// Export True Color 2024
Export.image.toDrive({
  image: image_2024.visualize(vis_2024).clip(exportROI),
  description: 'Istanbul_TrueColor_2024',
  scale: 30,
  region: exportROI,
  maxPixels: 1e13
});

// Export Land Reclaimed overlay on 2024
Export.image.toDrive({
  image: image_2024.visualize(vis_2024).blend(
    land_reclaimed.visualize(reclaimedVis)
  ).clip(exportROI),
  description: 'Istanbul_Land_Reclaimed',
  scale: 30,
  region: exportROI,
  maxPixels: 1e13
});

print('Export tasks created! Go to Tasks tab and click RUN');


// ========== EXPORT POLYGON LAND RECLAIMED ==========

// Converti raster land_reclaimed in vettore (polygon)
var land_reclaimed_vector = land_reclaimed.selfMask().reduceToVectors({
  geometry: exportROI,
  scale: 30,
  geometryType: 'polygon',
  eightConnected: false,
  maxPixels: 1e13,
  bestEffort: true
});

// Export as Shapefile
Export.table.toDrive({
  collection: land_reclaimed_vector,
  description: 'Istanbul_Land_Reclaimed_Polygon',
  fileFormat: 'SHP'
});

// also ROI as shapefile
Export.table.toDrive({
  collection: ee.FeatureCollection([ee.Feature(exportROI)]),
  description: 'Istanbul_ROI_Polygon',
  fileFormat: 'SHP'
});

print('Polygon export tasks created! Go to Tasks tab and RUN');
