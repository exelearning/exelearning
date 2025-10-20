<?php

namespace App\Repository\net\exelearning\Repository;

use App\Entity\net\exelearning\Entity\CurrentOdeUsers;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @method CurrentOdeUsers|null find($id, $lockMode = null, $lockVersion = null)
 * @method CurrentOdeUsers|null findOneBy(array $criteria, array $orderBy = null)
 * @method CurrentOdeUsers[]    findAll()
 * @method CurrentOdeUsers[]    findBy(array $criteria, array $orderBy = null, $limit = null, $offset = null)
 */
class CurrentOdeUsersRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, CurrentOdeUsers::class);
    }

    public function findByCurrentComponentId(string $currentComponentId): ?CurrentOdeUsers
    {
        return $this->createQueryBuilder('c')
            ->andWhere('c.currentComponentId = :currentComponentId')
            ->setParameter('currentComponentId', $currentComponentId)
            ->getQuery()
            ->getOneOrNullResult();
    }
    // /**
    //  * @return CurrentOdeUsers[] Returns an array of CurrentOdeUsers objects
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
    public function findOneBySomeField($value): ?CurrentOdeUsers
    {
        return $this->createQueryBuilder('c')
            ->andWhere('c.exampleField = :val')
            ->setParameter('val', $value)
            ->getQuery()
            ->getOneOrNullResult()
        ;
    }
    */

    /**
     * getCurrentUsers.
     *
     * @param string $odeId
     * @param string $odeVersionId
     * @param string $odeSessionId
     *
     * @return CurrentOdeUsers[]
     */
    public function getCurrentUsers($odeId, $odeVersionId, $odeSessionId)
    {
        $queryBuilder = $this->createQueryBuilder('c');

        if (!empty($odeId)) {
            $queryBuilder
                ->andWhere('c.odeId = :odeId')
                ->setParameter('odeId', $odeId);
        }

        if (!empty($odeVersionId)) {
            $queryBuilder
                ->andWhere('c.odeVersionId = :odeVersionId')
                ->setParameter('odeVersionId', $odeVersionId);
        }

        if (!empty($odeSessionId)) {
            $queryBuilder
                ->andWhere('c.odeSessionId = :odeSessionId')
                ->setParameter('odeSessionId', $odeSessionId);
        }

        $queryBuilder->orderBy('c.lastAction', 'DESC');

        return $queryBuilder
            ->getQuery()
            ->getResult()
        ;
    }

    /**
     * getCurrentSessionForUser.
     *
     * @param string $user
     *
     * @return CurrentOdeUsers
     */
    public function getCurrentSessionForUser($user)
    {
        return $this->createQueryBuilder('c')
            ->andWhere('c.user = :user')
            ->setParameter('user', $user)
            ->orderBy('c.lastAction', 'DESC')
            ->setMaxResults(1)
            ->getQuery()
            ->getOneOrNullResult()
        ;
    }

    /**
     * Removes CurrentOdeUser by odeSessionId and user.
     *
     * @param string $odeSessionId
     * @param string $user
     *
     * @return number
     */
    public function removeByOdeSessionIdAndUser($odeSessionId, $user)
    {
        $queryDeleteCurrentOdeUsers = $this->createQueryBuilder('n')
            ->delete()
            ->where('n.odeSessionId = :odeSessionId')
            ->setParameter('odeSessionId', $odeSessionId)
            ->andWhere('n.user = :user')
            ->setParameter('user', $user)
            ->getQuery();

        $currentOdeUsersDeleted = $queryDeleteCurrentOdeUsers->execute();

        return $currentOdeUsersDeleted;
    }
}
