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

export const defaultModel = 'llama3-3'

export const defaultPremiumModel = 'qwen3-235b'

export const models: ModelsObject = {
  'llama3-3': {
    value: 'llama3-3',
    hfValue: 'meta-llama/Llama-3.3-70B-Instruct',
    label: 'Llama 3.3',
    isPremium: false,
    maxTokens: 500,
  },
  'gpt-oss-120b': {
    value: 'gpt-oss-120b',
    hfValue: 'openai/gpt-oss-120b',
    label: 'GPT-OSS',
    isPremium: false,
    maxTokens: 1000,
  },
  'qwen3-coder-30b': {
    value: 'qwen3-coder-30b',
    hfValue: 'Qwen/Qwen3-Coder-30B-A3B-Instruct',
    label: 'Qwen3-Coder 30B',
    isPremium: false,
    maxTokens: 500,
  },
  'qwen3-235b': {
    value: 'qwen3-235b',
    hfValue: 'Qwen/Qwen3-235B-A22B-Instruct-2507',
    label: 'Qwen3 235B',
    isPremium: true,
    maxTokens: 2000,
  },
  'qwen3-coder-480b': {
    value: 'qwen3-coder-480b',
    hfValue: 'Qwen/Qwen3-Coder-480B-A35B-Instruct',
    label: 'Qwen3-Coder 480B',
    isPremium: true,
    maxTokens: 2000,
  },
  'deepseek-v3-terminus': {
    value: 'deepseek-v3-terminus',
    hfValue: 'deepseek-ai/DeepSeek-V3.1-Terminus',
    label: 'DeepSeek V3-Terminus',
    isPremium: true,
    maxTokens: 2500,
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
