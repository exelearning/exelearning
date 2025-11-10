<?php

namespace App\Controller\Api\Template;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\Finder\Finder;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Attribute\AsController;
use Symfony\Component\HttpKernel\KernelInterface;

#[AsController]
class ListTemplatesAction extends AbstractController
{
    public function __construct(
        private readonly KernelInterface $kernel,
    ) {
    }

    /**
     * List available .elpx template files for the given locale.
     * Templates are stored in public/templates/<locale>/.
     */
    public function __invoke(Request $request)
    {
        try {
            // Get locale from query parameter or use default from request
            $locale = $request->query->get('locale') ?? $request->getLocale();

            // Build template directory path
            $projectDir = $this->kernel->getProjectDir();
            $templatesDir = $projectDir.'/public/templates/'.$locale;

            // Check if the locale directory exists
            if (!is_dir($templatesDir)) {
                return $this->json([], 200);
            }

            // Find all .elpx files in the templates directory
            $finder = new Finder();
            $finder->files()
                ->in($templatesDir)
                ->name('*.elpx')
                ->sortByName();

            $templates = [];
            foreach ($finder as $file) {
                // Get filename without extension as the template name
                $filename = $file->getFilename();
                $name = $file->getBasename('.elpx');

                $templates[] = [
                    'name' => $name,
                    'filename' => $filename,
                    'path' => '/templates/'.$locale.'/'.$filename,
                    'locale' => $locale,
                ];
            }

            return $this->json($templates, 200);
        } catch (\Throwable $e) {
            return $this->json([
                'title' => 'Unexpected error',
                'detail' => $e->getMessage(),
                'type' => '/errors/500',
            ], 500);
        }
    }
}
