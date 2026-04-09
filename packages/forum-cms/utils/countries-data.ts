import * as fs from 'fs'
import * as path from 'path'

export type CountryName = {
  zh: string
  en: string
  vi: string
  id: string
  th: string
}

export type CountryRow = {
  code: string
  name: CountryName
}

const jsonPath = path.join(__dirname, '../public/files/countries.json')

function loadCountries(): CountryRow[] {
  const raw = fs.readFileSync(jsonPath, 'utf8')
  return JSON.parse(raw) as CountryRow[]
}

export const countries: CountryRow[] = loadCountries()

/** CMS 國籍下拉：中文名稱 + code，依中文排序 */
export const nationalitySelectOptions = countries
  .slice()
  .sort((a, b) => a.name.zh.localeCompare(b.name.zh, 'zh-Hant'))
  .map((c) => ({
    label: `${c.name.zh}（${c.code}）`,
    value: c.code,
  }))

export const nationalityCodes = new Set(countries.map((c) => c.code))
