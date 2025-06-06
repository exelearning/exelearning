<?php

namespace App\Repository\net\exelearning\Repository;

use App\Entity\net\exelearning\Entity\CrudTemplate;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @method CrudTemplate|null find($id, $lockMode = null, $lockVersion = null)
 * @method CrudTemplate|null findOneBy(array $criteria, array $orderBy = null)
 * @method CrudTemplate[]    findAll()
 * @method CrudTemplate[]    findBy(array $criteria, array $orderBy = null, $limit = null, $offset = null)
 */
class CrudTemplateRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, CrudTemplate::class);
    }

    // /**
    //  * @return CrudTemplate[] Returns an array of CrudTemplate objects
    //  */
    /*
    public function findByExampleField($value)
    {
        return $this->createQueryBuilder('c')
            ->andWhere('c.exampleField = :val')
            ->setParameter('val', $value)
            ->orderBy('c.id', 'ASC')
            ->setMaxResults(10)
            ->getQuery()
            ->getResult()
        ;
    }
    */

    /*
    public function findOneBySomeField($value): ?CrudTemplate
    {
        return $this->createQueryBuilder('c')
            ->andWhere('c.exampleField = :val')
            ->setParameter('val', $value)
            ->getQuery()
            ->getOneOrNullResult()
        ;
    }
    */
}
