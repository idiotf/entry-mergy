import fs from 'fs'
import path from 'path'

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'))

if (typeof packageJson.exports == 'string') {
  packageJson.exports = './dist/index.mjs'
} else {
  const exports = packageJson.exports
  for (const exportName in exports) {
    const name = exportName == '.' ? './index' : exportName
    exports[exportName].import = `./${path.join('dist', name)}.mjs`
    exports[exportName].types = `./${path.join('dist', name)}.d.mts`
  }
}

packageJson.main &&= './dist/index.mjs'
packageJson.types = './dist/index.d.mts'

fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2))
