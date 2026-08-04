import fs from 'fs'
import path from 'path'

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'))

if (typeof packageJson.exports == 'string') {
  packageJson.exports = './src/index.ts'
} else {
  const exports = packageJson.exports
  for (const exportName in exports) {
    const name = exportName == '.' ? './index' : exportName
    exports[exportName].import = `./${path.join('src', name)}.ts`
    exports[exportName].types = `./${path.join('src', name)}.ts`
  }
}

packageJson.main &&= './src/index.ts'
packageJson.types = './src/index.ts'

fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2))
