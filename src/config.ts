export interface BackendConfig {
  format: 'python' | 'java' | 'file'
  server?: string
}

export interface DataSourceConfig {
  ignoreHidden: boolean
  caching: boolean
  url: string
}

export interface AppConfig {
  url: {
    default: string
    list: Record<string, string>
  }
  data: {
    default: string
    list: Record<string, DataSourceConfig>
  }
  keys: {
    sentinalmap: string
  }
  backend: {
    default: string
    list: Record<string, BackendConfig>
  }
}

// Default configuration
const config: AppConfig = {
  url: {
    default: 'live',
    list: {
      dev: 'https://dev.libmap.org',
      live: 'https://libmap.org',
    },
  },
  data: {
    default: 'github',
    list: {
      github: {
        ignoreHidden: false,
        caching: true,
        url: 'https://raw.githubusercontent.com/decarbnow/data/master/',
      },
      local: {
        ignoreHidden: true,
        caching: true,
        url: 'http://127.0.0.1:8088/',
      },
    },
  },
  keys: {
    sentinalmap: import.meta.env.VITE_SENTINAL_MAP_KEY ?? '',
  },
  backend: {
    default: 'live',
    list: {
      live: {
        format: 'python',
        server: 'https://dev.libmap.org',
      },
      devServer: {
        format: 'python',
        server: 'https://dev.libmap.org',
      },
      devLocal: {
        format: 'python',
        server: 'http://127.0.0.1:5000',
      },
      file: {
        format: 'file',
      },
    },
  },
}

export function getBackendConfig(name?: string): BackendConfig {
  const backendName = name ?? config.backend.default
  const backend = config.backend.list[backendName]
  if (!backend) {
    throw new Error(`Unknown backend: ${backendName}`)
  }
  return backend
}

export function getDataConfig(name?: string): DataSourceConfig {
  const dataName = name ?? config.data.default
  const data = config.data.list[dataName]
  if (!data) {
    throw new Error(`Unknown data source: ${dataName}`)
  }
  return data
}

export default config
