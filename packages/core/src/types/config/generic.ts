type Generic = { type: 'generic' }
export type GenericMono<V extends string = string> = Generic & { strategy: 'mono'; key: V }
export type GenericMulti<V extends string[] = string[]> = Generic & { strategy: 'multi'; keys: V; preferred: V[number] }
export type GenericProp = GenericMono | GenericMulti
