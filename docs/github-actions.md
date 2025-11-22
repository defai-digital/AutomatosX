# GitHub Actions Integration with Gemini 3.0

This guide explains how to set up and use the GitHub Actions workflows that integrate Gemini 3.0 for automated code review and issue triage.

## Overview

AutomatosX includes two GitHub Actions workflows that leverage Gemini 3.0:

1. **PR Review Workflow** (`gemini-pr-review.yml`) - Automated code review for pull requests
2. **Issue Triage Workflow** (`gemini-issue-triage.yml`) - Automatic classification and labeling of issues

## Setup Instructions

### 1. Required Secrets

Add the following secrets to your GitHub repository settings:

#### `GEMINI_API_KEY`
- **Description**: Google Gemini API key for authentication
- **How to get**: 
  1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
  2. Create a new API key
  3. Copy and add to repository secrets
- **Permissions**: Required for both workflows

### 2. Repository Labels

Create the following labels in your repository for proper issue triage:

#### Type Labels
- `bug` - Error reports and broken functionality
- `feature` - New functionality requests  
- `documentation` - Documentation and examples
- `question` - Help requests and clarifications
- `performance` - Performance issues and optimization
- `security` - Security vulnerabilities and concerns
- `other` - Everything else

#### Priority Labels
- `priority: high` - Security issues, broken main functionality
- `priority: medium` - Important features, significant bugs
- `priority: low` - Minor issues, nice-to-have features

#### Area Labels
- `core` - Core AutomatosX functionality
- `cli` - Command-line interface
- `providers` - AI provider integrations
- `integrations` - External service integrations
- `docs` - Documentation and examples
- `tests` - Testing framework and test cases
- `infrastructure` - CI/CD, GitHub Actions, deployment

#### Status Labels
- `needs-info` - Requires additional information from reporter
- `needs-triage` - Manual triage required (fallback)

### 3. Workflow Permissions

The workflows require the following permissions:

#### PR Review Workflow
- `pull-requests: write` - To post review comments
- `contents: read` - To checkout and analyze code

#### Issue Triage Workflow  
- `issues: write` - To add labels and comments
- `contents: read` - To access repository context

## PR Review Workflow

### Triggers
- Pull requests opened, synchronized, or reopened
- Target branches: `main`, `develop`

### Features
- **Automatic diff analysis** - Extracts and analyzes code changes
- **Smart filtering** - Skips review for trivial changes (< 10 lines)
- **Comprehensive analysis** - Checks code quality, TypeScript, testing, security, and performance
- **Actionable feedback** - Provides specific suggestions with code examples
- **Comment management** - Updates existing bot comments instead of creating duplicates

### Review Process

1. **Diff Extraction**: Gets the git diff between base and head branches
2. **Gemini Analysis**: Runs comprehensive code review using Gemini 3.0 Pro
3. **Comment Generation**: Formats review as GitHub-flavored markdown
4. **PR Posting**: Posts or updates review comment on the pull request

### Review Categories

The PR review checks for:
- **Code Quality**: Best practices, patterns, maintainability
- **TypeScript**: Type safety, interfaces, proper typing
- **Testing**: Test coverage and quality
- **Documentation**: Missing or outdated documentation
- **Security**: Potential vulnerabilities
- **Performance**: Performance bottlenecks
- **Error Handling**: Proper error handling and edge cases

### Review Scoring

- **90-100**: ✅ Excellent, ready to merge (approve)
- **70-89**: 💬 Good with minor suggestions (comment)
- **50-69**: 💬 Needs some changes (comment)
- **0-49**: 🔄 Significant issues (request changes)

## Issue Triage Workflow

### Triggers
- Issues opened or edited

### Features
- **Automatic classification** - Categorizes issues by type, priority, and area
- **Smart labeling** - Applies appropriate labels based on content analysis
- **Assignment suggestions** - Suggests potential assignees when relevant
- **Information requests** - Identifies when additional information is needed
- **Fallback handling** - Gracefully handles classification failures

### Classification Process

1. **Issue Extraction**: Gathers title, body, author, and metadata
2. **Gemini Analysis**: Classifies issue using Gemini 2.5 Flash for speed
3. **Label Application**: Adds type, priority, area, and status labels
4. **Comment Creation**: Posts classification reasoning and next steps
5. **Assignment**: Suggests assignees when appropriate

### Classification Categories

#### Types
- `bug` - Error reports, broken functionality
- `feature` - New functionality requests
- `documentation` - Docs, README, examples
- `question` - Help requests, clarifications
- `performance` - Performance issues, optimization
- `security` - Security vulnerabilities, concerns
- `other` - Everything else

#### Priority
- `high` - Security issues, broken main functionality
- `medium` - Important features, significant bugs
- `low` - Minor issues, nice-to-have features

#### Areas
- `core` - Core AutomatosX functionality
- `cli` - Command-line interface
- `providers` - AI provider integrations
- `integrations` - External service integrations
- `docs` - Documentation and examples
- `tests` - Testing framework and test cases
- `infrastructure` - CI/CD, GitHub Actions, deployment

## Configuration

### Customizing Gemini Models

You can customize the Gemini models used by editing the workflow files:

#### PR Review Workflow
```yaml
gemini: {
  "model": "gemini-3-pro",           # Main model for thorough analysis
  "fallbackModel": "gemini-2.5-flash", # Fallback if main unavailable
  "timeout": 300000,                 # 5 minutes
}
```

#### Issue Triage Workflow
```yaml
gemini: {
  "model": "gemini-2.5-flash",       # Fast model for quick classification
  "timeout": 60000,                  # 1 minute
}
```

### Adjusting Review Sensitivity

#### Skip Threshold
Change the line count threshold for skipping reviews:
```yaml
if [ $TOTAL_LINES -lt 10 ]; then  # Change 10 to your preferred threshold
```

#### Analysis Scope
Modify which directories are included in analysis:
```yaml
"includeDirectories": ["src", "tests"],        # Analyze these
"excludeDirectories": ["node_modules", ".git"], # Skip these
```

## Troubleshooting

### Common Issues

#### 1. "Gemini classification failed"
- **Cause**: Missing or invalid `GEMINI_API_KEY`
- **Solution**: Verify the
API key is correctly set in repository secrets and has proper permissions

#### 2. "Timeout waiting for response"
- **Cause**: Analysis taking too long or API rate limits
- **Solution**: 
  - Increase timeout in workflow configuration
  - Check Gemini API quota and usage
  - Consider using fallback model for faster processing

#### 3. "Failed to parse diff"
- **Cause**: Malformed git diff or large binary files
- **Solution**: 
  - Check if PR includes binary files that should be excluded
  - Verify git diff format is correct
  - Add binary file patterns to exclude list

#### 4. "Missing labels" in issue triage
- **Cause**: Repository doesn't have required labels configured
- **Solution**: Create all required labels as listed in the setup section

### Debug Mode

Enable debug logging by adding these environment variables to workflow steps:

```yaml
env:
  DEBUG: "*"
  LOG_LEVEL: "debug"
```

### Performance Optimization

#### Reduce API Usage
- Use `gemini-2.5-flash` for initial triage (faster, cheaper)
- Reserve `gemini-3-pro` for detailed PR reviews
- Implement caching for repeated analyses

#### Parallel Processing
For large repositories, consider splitting analysis:
```yaml
strategy:
  matrix:
    file-group: [src, tests, docs]
```

## Best Practices

### 1. Review Quality
- Always review Gemini's suggestions before merging
- Use the scoring as guidance, not absolute rules
- Consider project-specific requirements

### 2. Label Consistency
- Maintain consistent label naming conventions
- Regularly review and update label descriptions
- Use label colors for visual distinction

### 3. API Management
- Monitor Gemini API usage and costs
- Implement rate limiting if needed
- Keep API keys secure and rotate regularly

### 4. Workflow Maintenance
- Update workflows when adding new file types
- Review and adjust classification prompts periodically
- Test workflows in a feature branch before production use

## Advanced Configuration

### Custom Review Prompts

You can customize the review prompts by modifying the `createAnalysisPrompt` method in `scripts/gemini-pr-review.ts`:

```typescript
private createAnalysisPrompt(fileChanges: FileChange[]): string {
  return `
  // Your custom prompt here
  Focus on your specific requirements:
  - Security best practices
  - Performance patterns
  - Code style guidelines
  `;
}
```

### Integration with Other Tools

#### Slack Notifications
Add Slack notifications for important reviews:

```yaml
- name: Notify Slack
  if: steps.review.outputs.score < 50
  uses: 8398a7/action-slack@v3
  with:
    status: failure
    text: "PR #${{ github.event.number }} requires attention - Score: ${{ steps.review.outputs.score }}"
```

#### Jira Integration
Link issues to Jira tickets:

```yaml
- name: Link to Jira
  if: contains(steps.classification.outputs.classification, 'jira')
  run: |
    # Custom Jira integration logic
```

## Security Considerations

### 1. API Key Protection
- Never commit API keys to repository
- Use repository secrets with restricted access
- Rotate keys regularly

### 2. Code Privacy
- Be aware that code changes are sent to Google's servers
- Review Google's data processing policies
- Consider using on-premises models for sensitive code

### 3. Access Control
- Limit who can modify workflow files
- Use protected branches for critical workflows
- Audit workflow changes regularly

## Monitoring and Analytics

### Track Workflow Performance
Monitor these metrics:
- Average review time per PR
- Classification accuracy
- API usage and costs
- False positive/negative rates

### GitHub Actions Insights
Use GitHub's built-in analytics:
- Workflow success/failure rates
- Execution time trends
- Resource usage patterns

## Contributing

When contributing to the GitHub Actions integration:

1. **Test changes** in a feature branch first
2. **Update documentation** for any configuration changes
3. **Add error handling** for new edge cases
4. **Consider backward compatibility** for existing setups
5. **Document breaking changes** in release notes

## Support

For issues with the GitHub Actions integration:

1. Check the [troubleshooting section](#troubleshooting) first
2. Review workflow logs for detailed error messages
3. Verify all prerequisites are properly configured
4. Open an issue in the AutomatosX repository with:
   - Workflow logs
   - Configuration details (without secrets)
   - Steps to reproduce

---

*This documentation covers the GitHub Actions integration for AutomatosX v8.5.3+ with Gemini 3.0 support.*
