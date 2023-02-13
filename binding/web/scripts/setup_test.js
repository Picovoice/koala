const fs = require('fs');
const { join } = require('path');

const modelFiles = ['koala_params.pv'];

console.log('Copying the koala model...');

const fixturesDirectory = join(__dirname, '..', 'cypress', 'fixtures')
const testDirectory = join(__dirname, '..', 'test');

const paramsSourceDirectory = join(
    __dirname,
    '..',
    '..',
    '..',
    'lib',
    'common',
);

const sourceDirectory = join(
    __dirname,
    "..",
    "..",
    "..",
    "resources",
);

try {
  modelFiles.forEach(file => {
    fs.copyFileSync(join(paramsSourceDirectory, file), join(testDirectory, file));
  });

  fs.mkdirSync(join(fixturesDirectory, 'audio_samples'), { recursive: true });
  fs.readdirSync(join(sourceDirectory, 'audio_samples')).forEach(file => {
    fs.copyFileSync(join(sourceDirectory, 'audio_samples', file), join(fixturesDirectory, 'audio_samples', file));
  });
} catch (error) {
  console.error(error);
}
