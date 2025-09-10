<?php

namespace App\Controller\net\exelearning\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\ErrorHandler\Exception\FlattenException;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Log\DebugLoggerInterface;

class ErrorController extends AbstractController
{
    public function show(Request $request, FlattenException $exception, ?DebugLoggerInterface $logger = null): Response
    {
        // Get error information
        $statusCode = $exception->getStatusCode();
        $message = $exception->getMessage();

        // Render your custom template
        return $this->render('security/error.html.twig', [
            'status_code' => $statusCode,
            'status_text' => Response::$statusTexts[$statusCode] ?? '',
            'error' => $message,
        ], new Response('', $statusCode));
    }
}
