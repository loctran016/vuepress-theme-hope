import {
  entries,
  fromEntries,
  getLocaleConfig,
  inferRootLocalePath,
  isPlainObject,
  keys,
  startsWith,
} from "@vuepress/helper";
import type { DocSearchPluginOptions } from "@vuepress/plugin-docsearch";
import type { SearchPluginOptions } from "@vuepress/plugin-search";
import type { SlimSearchPluginOptions } from "@vuepress/plugin-slimsearch";
import type { App, Page, Plugin } from "vuepress/core";
import { colors } from "vuepress/utils";

import type {
  PluginsOptions,
  ThemeData,
  ThemePageFrontmatter,
} from "../../shared/index.js";
import { themeLocalesData } from "../locales/index.js";
import { logger } from "../utils.js";

let docsearchPlugin: ((options: DocSearchPluginOptions) => Plugin) | null =
  null;
let searchPlugin: ((options: SearchPluginOptions) => Plugin) | null = null;
let slimsearchPlugin: ((options: SlimSearchPluginOptions) => Plugin) | null =
  null;
let cut: ((content: string, strict?: boolean) => string[]) | null = null;

try {
  ({ docsearchPlugin } = await import("@vuepress/plugin-docsearch"));
} catch {
  // Do nothing
}

try {
  ({ searchPlugin } = await import("@vuepress/plugin-search"));
} catch {
  // Do nothing
}

try {
  ({ slimsearchPlugin } = await import("@vuepress/plugin-slimsearch"));
  ({ cut } = await import("nodejs-jieba"));
} catch {
  // Do nothing
}

const DOCSEARCH_ZH_LOCALES = {
  placeholder: "搜索文档",
  translations: {
    button: {
      buttonText: "搜索文档",
      buttonAriaLabel: "搜索文档",
    },
    modal: {
      searchBox: {
        resetButtonTitle: "清除查询条件",
        resetButtonAriaLabel: "清除查询条件",
        cancelButtonText: "取消",
        cancelButtonAriaLabel: "取消",
      },
      startScreen: {
        recentSearchesTitle: "搜索历史",
        noRecentSearchesText: "没有搜索历史",
        saveRecentSearchButtonTitle: "保存至搜索历史",
        removeRecentSearchButtonTitle: "从搜索历史中移除",
        favoriteSearchesTitle: "收藏",
        removeFavoriteSearchButtonTitle: "从收藏中移除",
      },
      errorScreen: {
        titleText: "无法获取结果",
        helpText: "你可能需要检查你的网络连接",
      },
      footer: {
        selectText: "选择",
        navigateText: "切换",
        closeText: "关闭",
        searchByText: "搜索提供者",
      },
      noResultsScreen: {
        noResultsText: "无法找到相关结果",
        suggestedQueryText: "你可以尝试查询",
        reportMissingResultsText: "你认为该查询应该有结果？",
        reportMissingResultsLinkText: "点击反馈",
      },
    },
  },
};

const SEARCH_ZH_LOCALES = {
  placeholder: "搜索",
};

/**
 * @private
 *
 * Resolve options for @vuepress/plugin-docsearch, @vuepress/plugin-search and @vuepress/plugin-slimsearch
 */
export const getSearchPlugin = (
  app: App,
  themeData: ThemeData,
  plugins: PluginsOptions,
): Plugin | null => {
  const encryptedPaths = keys(themeData.encrypt.config ?? {});
  const isPageEncrypted = ({ path }: Page): boolean =>
    encryptedPaths.some((key) => startsWith(decodeURI(path), key));
  const { locales } = app.options;

  if (isPlainObject(plugins.docsearch)) {
    if (!docsearchPlugin) {
      logger.error(
        `${colors.cyan("@vuepress/plugin-docsearch")} is not installed!`,
      );

      return null;
    }

    return docsearchPlugin({
      locales: locales["/zh/"]
        ? { "/zh/": DOCSEARCH_ZH_LOCALES }
        : inferRootLocalePath(app) === "/zh/"
          ? { "/": DOCSEARCH_ZH_LOCALES }
          : {},
      ...plugins.docsearch,
    });
  }

  if (plugins.slimsearch) {
    if (!slimsearchPlugin) {
      logger.error(
        `${colors.cyan("@vuepress/plugin-slimsearch")} is not installed!`,
      );

      return null;
    }

    return slimsearchPlugin({
      indexContent: true,
      // Add supports for category and tags
      customFields: [
        {
          getter: (page: Page<Record<never, never>, ThemePageFrontmatter>) =>
            page.frontmatter.category,
          formatter: getLocaleConfig({
            app,
            name: "vuepress-theme-hope",
            default: fromEntries(
              entries(themeLocalesData).map(([localePath, config]) => [
                localePath,
                `${config.blogLocales.category}: $content`,
              ]),
            ),
          }),
        },
        {
          getter: (page: Page<Record<never, never>, ThemePageFrontmatter>) =>
            page.frontmatter.tag,
          formatter: getLocaleConfig({
            app,
            name: "vuepress-theme-hope",
            default: fromEntries(
              entries(themeLocalesData).map(([localePath, config]) => [
                localePath,
                `${config.blogLocales.tag}: $content`,
              ]),
            ),
          }),
        },
      ],
      filter: (page) => !isPageEncrypted(page),
      ...(cut
        ? {
            indexLocaleOptions: locales["/zh/"]
              ? {
                  "/zh/": {
                    tokenize: (text, fieldName) =>
                      fieldName === "id" ? [text] : cut(text, true),
                  },
                }
              : inferRootLocalePath(app) === "/zh/"
                ? {
                    "/": {
                      tokenize: (text, fieldName) =>
                        fieldName === "id" ? [text] : cut(text, true),
                    },
                  }
                : {},
          }
        : {}),
      ...(isPlainObject(plugins.slimsearch) ? plugins.slimsearch : {}),
    });
  }

  if (plugins.search) {
    if (!searchPlugin) {
      logger.error(
        `${colors.cyan("@vuepress/plugin-search")} is not installed!`,
      );

      return null;
    }

    return searchPlugin({
      isSearchable: (page) => !isPageEncrypted(page),
      locales: locales["/zh/"]
        ? { "/zh/": SEARCH_ZH_LOCALES }
        : inferRootLocalePath(app) === "/zh/"
          ? { "/": SEARCH_ZH_LOCALES }
          : {},
      ...(isPlainObject(plugins.search) ? plugins.search : {}),
    });
  }

  return null;
};
