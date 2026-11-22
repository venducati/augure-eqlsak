import sharp from 'sharp';
// Asset export only: the detail restoration was done with the built-in image tool.
// Keep the native refined master; do not claim this resampled export is native 4K.
await sharp('public/eqlsak-mural-refined-master.png').resize(3840,2160,{fit:'cover',kernel:'lanczos3'}).webp({lossless:true,effort:6}).toFile('public/eqlsak-mural-refined-4k.webp');
console.log(await sharp('public/eqlsak-mural-refined-4k.webp').metadata());
