export const resources = {
  'zh-CN': {
    translation: {
      common: {
        appName: 'SNK Onchain',
        notFound: '页面不存在',
        retry: '重试',
      },
      settings: {
        language: '语言',
        theme: '主题',
        localeName: '中文',
        themeNames: {
          blue: '蓝色',
          violet: '紫色',
          emerald: '绿色',
        },
      },
      home: {
        ready: 'React.js 标准项目模板已就绪。',
        start: '打开 Dialog',
        dialog: {
          title: 'Dialog 组件示例',
          description: '这是一个基于 shadcn/ui 和 Radix UI 的可访问弹窗。',
          content: '你可以在 src/components/ui/dialog.tsx 中扩展这个基础组件。',
          action: '知道了',
        },
      },
      error: {
        title: '页面出现异常',
        description: '请稍后重试，或联系系统管理员。',
      },
    },
  },
  'en-US': {
    translation: {
      common: {
        appName: 'SNK Onchain',
        notFound: 'Page not found',
        retry: 'Retry',
      },
      settings: {
        language: 'Language',
        theme: 'Theme',
        localeName: 'English',
        themeNames: {
          blue: 'Blue',
          violet: 'Violet',
          emerald: 'Emerald',
        },
      },
      home: {
        ready: 'React.js project template is ready.',
        start: 'Open Dialog',
        dialog: {
          title: 'Dialog component demo',
          description: 'This accessible dialog is built with shadcn/ui and Radix UI.',
          content: 'You can extend this primitive in src/components/ui/dialog.tsx.',
          action: 'Got it',
        },
      },
      error: {
        title: 'Something went wrong',
        description: 'Please try again later or contact an administrator.',
      },
    },
  },
} as const;
