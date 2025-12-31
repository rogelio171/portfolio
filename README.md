# Rogelio Orona - Portfolio

A modern, professional portfolio website for a Senior Software Engineer built with [Hugo](https://gohugo.io/) and the [Blowfish](https://blowfish.page/) theme.

## Features

- 🎨 **Modern UI** - Clean, professional design with dark theme
- 📱 **Responsive** - Works great on all devices
- ⚡ **Fast** - Static site generation for optimal performance
- 📝 **Blog Ready** - Built-in blog section for sharing technical content
- 🔍 **Search** - Full-text search functionality
- 🏷️ **Tags** - Organized content with tagging support

## Tech Stack

- **Hugo** - Static site generator
- **Blowfish Theme** - Modern Hugo theme
- **GitHub Actions** - Automated deployment to GitHub Pages

## Local Development

### Prerequisites

- [Hugo Extended](https://gohugo.io/installation/) (v0.112.0 or later)
- [Go](https://golang.org/dl/) (for Hugo Modules)

### Running Locally

```bash
# Clone the repository
git clone https://github.com/rogelioorona/portfolio.git
cd portfolio

# Start the development server
hugo server -D
```

Visit `http://localhost:1313/portfolio/` in your browser.

### Building for Production

```bash
hugo --minify
```

The static files will be generated in the `public/` directory.

## Adding Blog Posts

Create a new blog post:

```bash
hugo new blog/my-new-post/index.md
```

Edit the generated markdown file and add your content.

## Deployment

This site is configured to deploy automatically to GitHub Pages using GitHub Actions. Simply push to the `main` branch and the site will be built and deployed.

## License

MIT License - feel free to use this as a template for your own portfolio!

