# ts-module-alias-transformer

[![npm version](https://img.shields.io/npm/v/ts-module-alias-transformer.svg)](https://www.npmjs.com/package/ts-module-alias-transformer)
[![Build Status](https://travis-ci.org/t83714/ts-module-alias-transformer.svg?branch=master)](https://travis-ci.org/t83714/ts-module-alias-transformer)

A cli tool uses Babel to rewrite module name from typescript's build result including .d.ts files.

It uses 
- [@babel/core](https://www.npmjs.com/package/@babel/core) to parse built js files
- [@babel/plugin-syntax-typescript](https://www.npmjs.com/package/@babel/plugin-syntax-typescript) to parse `.d.ts` files
- and use [babel-plugin-module-resolver](https://github.com/tleunen/babel-plugin-module-resolver) to replace module path in your typescript build result (either `.js` or `.d.ts` files).

This command line tool is bundled with all dependencies (including @babel/core). Thus, it doesn't require installing any dependencies and won't pollute the dependency tree in your local project.

### Installation

```bash
npm install -g ts-module-alias-transformer
```

### Usage

```
Usage: ts-module-alias-transformer [options] <src> [dst]

A cli tool uses Babel to rewrite module name from typescript's build result including .d.ts files.
  <src>: The source directory / file that contains typescript build result.
  [dst]: Optional. The destination directory / file. If not provided, output will replace the <src>.

Options:
  -V, --version                              output the version number
  -p, --mappingConfigPath <packageJsonPath>  Optional. Specify the mapping config json file location. 
                                             By default, it will read the `_moduleMappings` field of package.json in current working 
                                             directory to determine the module paths to replace. 
                                             See https://github.com/t83714/ts-module-alias-transformer for more details.
  -h, --help                                 output usage information
```

### Configuration
 
 By default, it will read the `_moduleMappings` field of package.json in current working directory to determine the module paths to replace (unless the switch `-p` is provided to specify an alternative config file location). 
 
 e.g. Here is an example:

```json
{
  "name": "....",
  "version": "1.0.0",
  "description": "...",
  "_moduleMappings": {
      "@a/b/c": "../../a/b/c",
      "@x/y/z": "../d/e/f"
  }
}
```

