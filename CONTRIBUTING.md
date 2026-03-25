# Contributing to DealEat

Thank you for your interest in contributing to DealEat! We welcome all contributions.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally
3. **Create a branch** for your feature or bug fix:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development

### Prerequisites
- Python 3.10+
- Playwright installed (`pip install playwright`)

### Local Development Server

```bash
cd C:\Users\necat\Desktop\dealeat
py -m http.server 8081
```

Then open http://localhost:8081

### Running the Scraper

```bash
cd dealeat_scraper

# Test scraper (first 3 restaurants)
py playwright_scraper.py --test

# Full scrape
py playwright_scraper.py

# Export and embed data
py export_json.py
py gen_static_restaurants.py
```

## Code Style

- **JavaScript**: Vanilla JS, no frameworks
- **Python**: Follow PEP 8
- **HTML/CSS**: Semantic HTML, CSS variables for theming

## Submitting Changes

1. **Commit your changes** with a clear message:
   ```bash
   git commit -m "Add feature: description"
   ```

2. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

3. **Create a Pull Request** on GitHub with:
   - Clear title and description
   - Reference any related issues
   - Screenshots if UI changes

## Types of Contributions

### Bug Reports
- Use GitHub Issues
- Include browser/device info
- Describe steps to reproduce
- Share error messages if any

### Feature Requests
- Use GitHub Issues labeled `enhancement`
- Explain the use case
- Provide examples or mockups if relevant

### Code Contributions
- Scrapers for new platforms (Yemeksepeti, Getir)
- UI improvements
- Performance optimizations
- Bug fixes

### Documentation
- Improve README
- Add code comments
- Update project structure docs
- Tutorial or how-to guides

## Reporting Issues

Please use GitHub Issues to report:
- Bugs (broken features)
- Performance problems
- Missing or incorrect data
- Deployment issues

## Questions?

Feel free to open a GitHub Discussion or Issue if you have questions!

---

Thanks for helping make DealEat better! 🍕
