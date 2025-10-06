type Model = {
  value: string
  label: string
  isPremium: boolean
}

type ModelsObject = {
  [key: string]: Model
}

export const models = {
  'gpt-oss-20b': {
    value: 'gpt-oss-20b',
    label: 'GPT-OSS 20B',
    isPremium: false,
  },
  'llama3-3': { value: 'llama3-3', label: 'Llama 3.3', isPremium: false },
  'qwen3-coder-30b': {
    value: 'qwen3-coder-30b',
    label: 'Qwen3-Coder 30B',
    isPremium: false,
  },
  'gpt-oss-120b': {
    value: 'gpt-oss-120b',
    label: 'GPT-OSS 120B',
    isPremium: true,
  },
  'qwen3-coder-480b': {
    value: 'qwen3-coder-480b',
    label: 'Qwen3-Coder 480B',
    isPremium: true,
  },
  'deepseek-r1': {
    value: 'deepseek-r1',
    label: 'DeepSeek R1',
    isPremium: true,
  },
  'deepseek-v3-terminus': {
    value: 'deepseek-v3-terminus',
    label: 'DeepSeek V3-Terminus',
    isPremium: true,
  },
}

export function createModelGroups(
  models: ModelsObject,
  selectedModelKey = 'gpt-oss-20b',
) {
  const basicModels: Model[] = []
  const premiumModels: Model[] = []

  // Sort models into basic and premium arrays
  Object.entries(models).forEach(([key, model]) => {
    const modelWithSelection = {
      ...model,
      selected: key === selectedModelKey,
    }

    if (model.isPremium) {
      premiumModels.push(modelWithSelection)
    } else {
      basicModels.push(modelWithSelection)
    }
  })

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
