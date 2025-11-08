<?php

namespace App\Controller\net\exelearning\Controller\Api;

use Doctrine\ORM\EntityManagerInterface;
use Psr\Log\LoggerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Mercure\HubInterface;
use Symfony\Component\Mercure\Update;
use Symfony\Component\Security\Core\User\UserInterface;
use Symfony\Component\Serializer\SerializerInterface;
use Symfony\Component\Uid\Uuid;

class DefaultApiController extends AbstractController
{
    // Status codes
    public const STATUS_CODE_OK = 200;
    public const STATUS_CODE_MOVED_PERMANENTLY = 301;
    public const STATUS_CODE_NOT_FOUND = 404;
    public const STATUS_CODE_SERVICE_UNAVAILABLE = 503;

    protected $entityManager;

    protected $logger;

    protected $status;

    protected SerializerInterface $serializer;
    /**
     * Mercure hub.
     *
     * @var HubInterface
     */
    protected $hub;

    public function __construct(
        EntityManagerInterface $entityManager,
        LoggerInterface $logger,
        SerializerInterface $serializer,
        ?HubInterface $hub = null,
    ) {
        $this->entityManager = $entityManager;
        $this->logger = $logger;
        $this->status = self::STATUS_CODE_OK;
        $this->serializer = $serializer;
        $this->hub = $hub;
    }

    /**
     * Converts the data received to json.
     *
     * @return string json
     */
    protected function getJsonSerialized($data)
    {
        return $this->serializer->serialize($data, 'json');
    }

    /**
     * Ensures request parameters are available when the payload is sent in the
     * body of non-POST requests (e.g. PUT form submissions or JSON payloads).
     */
    protected function hydrateRequestBody(Request $request): void
    {
        if (!\in_array($request->getMethod(), ['PUT', 'PATCH', 'DELETE'], true)) {
            return;
        }

        if ($request->request->count() > 0) {
            return;
        }

        $content = $request->getContent();

        if ('' === $content) {
            return;
        }

        $contentType = strtolower((string) $request->headers->get('Content-Type'));

        if (str_contains($contentType, 'application/json')) {
            $decoded = json_decode($content, true);

            if (is_array($decoded)) {
                $request->request->add($decoded);

                return;
            }
        }

        if (str_contains($contentType, 'application/x-www-form-urlencoded') || str_contains($contentType, 'multipart/form-data')) {
            $parsed = [];
            parse_str($content, $parsed);

            if (!empty($parsed)) {
                $request->request->add($parsed);
            }
        }
    }

    /**
     * Return symfony path.
     *
     * @param Request $request
     *
     * @return string $symfonyFullUrl
     */
    protected function getSymfonyUrl($request)
    {
        // Base URL
        $symfonyBaseURL = $request->getSchemeAndHttpHost();
        $symfonyBasePath = $request->getBaseURL();
        $symfonyFullUrl = $symfonyBaseURL;

        if ($symfonyBasePath) {
            $symfonyFullUrl .= $symfonyBasePath;
        }

        return $symfonyFullUrl;
    }

    /**
     * Return session id.
     *
     * @param Request     $request
     * @param string|null $parameterOdeSessionId
     *
     * @return string $odeSessionId
     */
    protected function getOdeSessionId($request, $parameterOdeSessionId = null)
    {
        $odeSessionId = $request->get('odeSessionId');

        if (null !== $odeSessionId) {
            $odeSessionId = $odeSessionId;
        } else {
            // First check if parameterOdeSessionId has been send
            if ($parameterOdeSessionId) {
                $odeSessionId = $parameterOdeSessionId;
            }
        }

        return $odeSessionId;
    }

    /**
     * Get a user from the Security Token Storage.
     *
     * @throws \LogicException If SecurityBundle is not available
     *
     * @see TokenInterface::getUser()
     */
    protected function getUser(): ?UserInterface
    {
        $user = parent::getUser();
        if (empty($user)) {
            $user = $this->container->get('session')->get('SESSION_USER_DATA');
        }

        return $user;
    }

    /**
     * Publish message to mercure hub. $odeSessionId is used as topic. Returns false if no hub available.
     */
    protected function publish(string $odeSessionId, string $eventName): string|bool
    {
        if (null === $this->hub) {
            return false;
        }
        $uuid = Uuid::v4();
        $update = new Update(
            $odeSessionId,
            json_encode(['name' => $eventName]),
            false,
            $uuid,
        );
        try {
            $result = $this->hub->publish($update);
        } catch (\RuntimeException $exception) {
            $result = false;
            $this->logger->error("Failed to publish event '$eventName' on topic $odeSessionId.");
        }

        return $result;
    }
}
