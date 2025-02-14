export type SystemValues = Partial<{ light: string; dark: string; system: string; custom: string[] }>

export type Options = string | string[] | SystemValues

export type ExplicitProp = { prop: string; values: Options }

export type Props = (string | ExplicitProp)[]