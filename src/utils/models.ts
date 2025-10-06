export type Model = {
  value: string
  hfValue: string
  label: string
  isPremium: boolean
}

export type ModelsObject = {
  [key: string]: Model
}

export const models: ModelsObject = {
  'gpt-oss-20b': {
    value: 'gpt-oss-20b',
    hfValue: 'openai/gpt-oss-20b',
    label: 'GPT-OSS 20B',
    isPremium: false,
  },
  'llama3-3': {
    value: 'llama3-3',
    hfValue: 'meta-llama/Llama-3.3-70B-Instruct',
    label: 'Llama 3.3',
    isPremium: false,
  },
  'qwen3-coder-30b': {
    value: 'qwen3-coder-30b',
    hfValue: 'Qwen/Qwen3-Coder-30B-A3B-Instruct',
    label: 'Qwen3-Coder 30B',
    isPremium: false,
  },
  'gpt-oss-120b': {
    value: 'gpt-oss-120b',
    hfValue: 'openai/gpt-oss-120b',
    label: 'GPT-OSS 120B',
    isPremium: true,
  },
  'qwen3-coder-480b': {
    value: 'qwen3-coder-480b',
    hfValue: 'Qwen/Qwen3-Coder-480B-A35B-Instruct',
    label: 'Qwen3-Coder 480B',
    isPremium: true,
  },
  'deepseek-r1': {
    value: 'deepseek-r1',
    hfValue: 'deepseek-ai/DeepSeek-R1',
    label: 'DeepSeek R1',
    isPremium: true,
  },
  'deepseek-v3-terminus': {
    value: 'deepseek-v3-terminus',
    hfValue: 'deepseek-ai/DeepSeek-V3.1-Terminus',
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
