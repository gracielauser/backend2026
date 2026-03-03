const fs = require('fs');
const path = require('path');

function convertImageToBase64(relativePath) {
  const imagePath = path.resolve(__dirname, relativePath);
  const image = fs.readFileSync(imagePath);
  const extension = path.extname(imagePath).substring(1);
  return `data:image/${extension};base64,${image.toString('base64')}`;
}

module.exports = convertImageToBase64;
