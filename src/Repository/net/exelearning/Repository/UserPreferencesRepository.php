<?php

namespace App\Repository\net\exelearning\Repository;

use App\Entity\net\exelearning\Entity\UserPreferences;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @method UserPreferences|null find($id, $lockMode = null, $lockVersion = null)
 * @method UserPreferences|null findOneBy(array $criteria, array $orderBy = null)
 * @method UserPreferences[]    findAll()
 * @method UserPreferences[]    findBy(array $criteria, array $orderBy = null, $limit = null, $offset = null)
 */
class UserPreferencesRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, UserPreferences::class);
    }

    // /**
    //  * @return UserPreferences[] Returns an array of UserPreferences objects
    //  */
    /*
    public function findByExampleField($value)
    {
        return $this->createQueryBuilder('o')
            ->andWhere('o.exampleField = :val')
            ->setParameter('val', $value)
            ->orderBy('o.id', 'ASC')
            ->setMaxResults(10)
            ->getQuery()
            ->getResult()
        ;
    }
    */

    /*
    public function findOneBySomeField($value): ?UserPreferences
    {
        return $this->createQueryBuilder('o')
            ->andWhere('o.exampleField = :val')
            ->setParameter('val', $value)
            ->getQuery()
            ->getOneOrNullResult()
        ;
    }
    */
}
