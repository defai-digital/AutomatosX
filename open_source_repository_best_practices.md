
# Research Report: Best Practices for Open Source Repository Structure

**Author:** Rodman, Researcher  
**Date:** 2025-11-18

## 1. Executive Summary

This report examines the best practices for the structure of open-source repositories on GitHub, specifically addressing the question of whether to make only the `src/` folder public or the entire repository.

**Conclusion:** The overwhelming industry standard and recommended best practice for open-source projects is to make the **entire repository public**. This includes not only the source code (`src/`) but also documentation (`docs/`), tests (`tests/`), build scripts (`scripts/`), and configuration files.

This practice is driven by the core values of open source: transparency, collaboration, and community. A fully public repository provides the context needed for effective contribution, ensures reproducibility, and allows for community-driven quality and security assurance. Security is managed not by hiding information, but by diligently excluding sensitive data (e.g., API keys, credentials) through mechanisms like `.gitignore`.

## 2. Background & Objectives

The primary objective of this research was to determine the industry standard for the visibility of files within an open-source GitHub repository. The key question was: "Should an open source project on GitHub make only the src/ folder public, or should the entire repository (including tests, docs, config files, CI/CD) be public?"

This report addresses this question by:
1.  Reviewing established best practices and expert opinions.
2.  Analyzing the repository structure of well-known, large-scale open-source projects.
3.  Evaluating the security implications of a fully public repository.

## 3. Methodology

The research was conducted through a series of targeted web searches to gather information on best practices and to analyze the structure of prominent open-source projects. The findings from these searches were synthesized to form a comprehensive answer. The analysis of well-known projects serves as real-world evidence of the established standards.

## 4. Findings & Analysis

### 4.1. The Case for a Fully Public Repository

The consensus among developers and open-source advocates is that a healthy open-source project is a fully transparent one. Here’s why a public-by-default approach for all non-sensitive files is the standard:

*   **Transparency and Trust:** A complete view of the project, including its tests and build processes, builds trust with the community. It shows that the project has nothing to hide and is confident in its quality and processes.
*   **Lowering the Barrier to Contribution:** Contributors need more than just the source code. To fix a bug or add a feature, they need to run tests, understand the documentation, and work with the project's build tools. Hiding these components would make it significantly harder for new contributors to get started.
*   **Community-Driven Quality Assurance:** Public tests and CI/CD configurations allow the community to verify that the project is well-tested and to suggest improvements to the testing strategy. This collaborative approach to quality is a hallmark of successful open-source projects.
*   **Reproducibility:** For a project to be truly open source, others must be able to build it from scratch. This requires access to build scripts and configuration files.

### 4.2. Analysis of Well-Known Open-Source Projects

An analysis of several large-scale, successful open-source projects confirms that a fully public repository is the norm.

*   **React (by Meta):** The [React repository on GitHub](https://github.com/facebook/react) includes a `packages` directory (as it's a monorepo), `scripts` for building and testing, and extensive configuration files for tools like Rollup, Jest, and ESLint.
*   **Vue.js:** Similar to React, the [Vue.js repository](https://github.com/vuejs/vue) is a monorepo with a `packages` directory containing the various parts of the framework. It also includes `scripts`, `test-dts` (for TypeScript definition tests), and numerous configuration files.
*   **Visual Studio Code (by Microsoft):** The [VS Code repository](https://github.com/microsoft/vscode) is another example of a complex project with a fully public structure. It contains `src`, `build`, `extensions`, `scripts`, and a host of configuration files. The `build` directory contains build-related scripts and configurations, not the build output itself.

These examples demonstrate a clear and consistent pattern: successful open-source projects embrace transparency by making their entire development infrastructure public.

### 4.3. Security Implications

The primary argument against a fully public repository is security. The concern is that exposing configuration files, test data, or dependencies could reveal vulnerabilities. However, the open-source community manages this risk through the following practices:

*   **Never Commit Secrets:** This is the golden rule of security in open-source projects. All sensitive information, such as API keys, passwords, and other credentials, must be excluded from the repository. The standard method for this is to store secrets in environment variables or in a file (e.g., `.env`) that is listed in the `.gitignore` file.
*   **Public Configuration is Not a Secret:** Configuration files for tools like Webpack, ESLint, or CI/CD pipelines are generally not sensitive. They define the build process, not the secrets used in that process. Exposing them is not a security risk and can even be beneficial, as it allows the community to review the build and test configurations.
*   **Dependency Scanning:** Tools like GitHub's Dependabot automatically scan for vulnerabilities in dependencies and create pull requests to update them. This is a powerful, automated way to manage the security of a project's supply chain.
*   **Security Through Transparency:** In the open-source world, security is often enhanced by transparency. When more people can see the code, the tests, and the build process, there are more opportunities to spot and fix potential vulnerabilities. This is often referred to as "Linus's Law": "Given enough eyeballs, all bugs are shallow."

## 5. Feasibility/Risk Matrix

| Decision/Action | Feasibility | Risk | Mitigation |
| :--- | :--- | :--- | :--- |
| **Make entire repository public** | **High** | **Low** | Strictly enforce a "no secrets in the repo" policy. Use `.gitignore` to exclude sensitive files. Automate dependency scanning. |
| **Make only `src/` public** | **Low** | **High** | N/A. This approach is not recommended as it hinders collaboration, reduces transparency, and goes against established open-source best practices. |

## 6. Options & Recommendations

Based on the research, there is only one recommended option:

**Recommendation: Make the entire repository public.**

This includes:
*   `src/`: The source code.
*   `tests/`: All unit, integration, and end-to-end tests.
*   `docs/`: All project documentation.
*   `scripts/` or `tools/`: Build, test, and other automation scripts.
*   All configuration files (e.g., `package.json`, `webpack.config.js`, `.eslintrc.json`, CI/CD configuration).

**Crucial Caveat:** This recommendation is contingent on the strict and unwavering practice of never committing sensitive information to the repository.

## 7. Citations & Appendices

The findings in this report are based on a synthesis of information from numerous articles, blog posts, and official documentation related to open-source best practices, as well as a direct analysis of the structure of major open-source projects on GitHub.
