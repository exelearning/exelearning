<?php

namespace App\Entity\Project;

use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

class ProjectPropertyRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, ProjectProperty::class);
    }

    /** @return ProjectProperty[] */
    public function findByOdeId(string $odeId): array
    {
        return $this->createQueryBuilder('p')
            ->andWhere('p.odeId = :odeId')
            ->setParameter('odeId', $odeId)
            ->getQuery()
            ->getResult();
    }

    public function upsert(string $odeId, string $key, string $value): ProjectProperty
    {
        $prop = $this->findOneBy(['odeId' => $odeId, 'key' => $key]);
        if (!$prop) {
            $prop = new ProjectProperty();
            $prop->setOdeId($odeId)->setKey($key);
        }
        $prop->setValue($value)->setUpdatedAt(new \DateTime());
        $em = $this->getEntityManager();
        $em->persist($prop);

        return $prop;
    }
}
