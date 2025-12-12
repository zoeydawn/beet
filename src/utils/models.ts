export type Model = {
  value: string
  hfValue: string
  label: string
  isPremium: boolean
  maxTokens?: number
}

export type ModelsObject = {
  [key: string]: Model
}

export const defaultModel = 'gpt-oss-20b'

export const defaultPremiumModel = 'gpt-oss-120b'

export const models: ModelsObject = {
  'gpt-oss-20b': {
    value: 'gpt-oss-20b',
    hfValue: 'openai/gpt-oss-20b',
    label: 'GPT-OSS 20B',
    isPremium: false,
    maxTokens: 10000,
    // contextLength: 128000
  },
  // 'qwen3-14b': {
  //   value: 'qwen3-14b',
  //   hfValue: 'Qwen/Qwen3-14B',
  //   label: 'Qwen3 14B',
  //   isPremium: false,
  //   maxTokens: 4000,
  //   // contextLength: 33k
  // },
  'qwen3-coder-30b': {
    value: 'qwen3-coder-30b',
    hfValue: 'Qwen/Qwen3-Coder-30B-A3B-Instruct',
    label: 'Qwen3-Coder 30B',
    isPremium: false,
    maxTokens: 20000,
    // contextLength: 256k
  },
  'apertus-70b': {
    value: 'apertus-70b',
    hfValue: 'swiss-ai/Apertus-70B-Instruct-2509:publicai',
    label: 'Swiss AI Apertus 70B',
    isPremium: false,
    maxTokens: 6000,
    // contextLength: 65k
  },
  'gpt-oss-120b': {
    value: 'gpt-oss-120b',
    hfValue: 'openai/gpt-oss-120b',
    label: 'GPT-OSS 120B',
    isPremium: true,
    maxTokens: 10000,
    // contextLength: 128000
  },
  'qwen3-235b': {
    value: 'qwen3-235b',
    hfValue: 'Qwen/Qwen3-235B-A22B-Instruct-2507:fireworks-ai',
    label: 'Qwen3 235B',
    isPremium: true,
    maxTokens: 20000,
    // contextLength: 262144
  },
  'qwen3-coder-480b': {
    value: 'qwen3-coder-480b',
    hfValue: 'Qwen/Qwen3-Coder-480B-A35B-Instruct',
    label: 'Qwen3-Coder 480B',
    isPremium: true,
    maxTokens: 20000,
    // contextLength: 256k
  },
  'deepseek-v3-terminus': {
    value: 'deepseek-v3-terminus',
    hfValue: 'deepseek-ai/DeepSeek-V3.1-Terminus',
    label: 'DeepSeek V3 Terminus',
    isPremium: true,
    maxTokens: 10000,
    // contextLength: 128000
  },
}

export function createModelGroups(
  models: ModelsObject,
  selectedModelKey?: string,
  isPremiumUser = false,
) {
  const basicModels: Model[] = []
  const premiumModels: Model[] = []

  const selectedModel = selectedModelKey
    ? selectedModelKey
    : isPremiumUser
      ? defaultPremiumModel
      : defaultModel

  // Sort models into basic and premium arrays
  Object.entries(models).forEach(([key, model]) => {
    const modelWithSelection = {
      ...model,
      selected: key === selectedModel,
      disabled: !isPremiumUser && model.isPremium,
    }

    if (model.isPremium) {
      premiumModels.push(modelWithSelection)
    } else {
      basicModels.push(modelWithSelection)
    }
  })

  // display premium models first for premium users
  if (isPremiumUser) {
    return [
      {
        groupName: 'Premium models',
        models: premiumModels,
      },
      {
        groupName: 'Basic models',
        models: basicModels,
      },
    ]
  }

  return [
    {
      groupName: 'Basic models',
      models: basicModels,
    },
    {
      groupName: 'Premium models',
      models: premiumModels,
    },
  ]
}
