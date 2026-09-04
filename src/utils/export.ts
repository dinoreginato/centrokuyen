export const exportUtils = {
  toCSV: (data: any[], filename: string) => {
    if (data.length === 0) return
    const headers = Object.keys(data[0])
    const escapeValue = (value: unknown) => {
      const serialized = value == null ? '' : String(value)
      return `"${serialized.replace(/"/g, '""')}"`
    }
    const csvContent = [
      headers.map(escapeValue).join(','),
      ...data.map(row => headers.map(key => escapeValue(row[key])).join(','))
    ].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${filename}.csv`
    link.click()
    window.URL.revokeObjectURL(url)
  },

  toJSON: (data: unknown, filename: string) => {
    const jsonContent = JSON.stringify(data, null, 2)
    const blob = new Blob([jsonContent], { type: 'application/json' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${filename}.json`
    link.click()
    window.URL.revokeObjectURL(url)
  }
}
