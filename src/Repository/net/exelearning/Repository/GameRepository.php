<?php

namespace App\Repository\net\exelearning\Repository;

use Doctrine\DBAL\Connection;

class GameRepository
{
    private $connection;

    public function __construct(Connection $connection)
    {
        $this->connection = $connection;
    }

    public function getIdevicesBySessionId(string $odeSessionId): array
    {
        $sql = <<<SQL
            SELECT
                p.id AS navId,
                p.ode_nav_structure_sync_id,
                p.ode_session_id,
                p.ode_page_id AS odePageId,
                p.ode_parent_page_id AS odeParentPageId,
                p.page_name AS pageName,
                p.ode_nav_structure_sync_order,
                p.is_active AS navIsActive,
                c.id AS componentId,
                c.ode_pag_structure_sync_id,
                c.html_view AS htmlViewer,
                c.json_properties AS jsonProperties,
                c.ode_session_id AS componentSessionId,
                c.ode_page_id AS componentPageId,
                c.ode_block_id,
                c.ode_idevice_id,
                c.ode_idevice_type_name AS odeIdeviceTypeName,
                c.ode_components_sync_order,
                c.is_active AS componentIsActive,
                ps.block_name AS blockName,
                ps.ode_pag_structure_sync_order AS blockOrder
            FROM ode_nav_structure_sync p
            LEFT JOIN ode_components_sync c
                ON p.ode_page_id = c.ode_page_id
                AND p.ode_session_id = c.ode_session_id
                AND c.is_active = 1
            LEFT JOIN ode_pag_structure_sync ps
                ON c.ode_block_id = ps.ode_block_id
                AND c.ode_page_id = ps.ode_page_id
                AND ps.ode_session_id = p.ode_session_id
            WHERE p.ode_session_id = :odeSessionId
            ORDER BY 
                p.ode_nav_structure_sync_order ASC,
                ps.ode_pag_structure_sync_order ASC,
                c.ode_components_sync_order ASC
            SQL;

        return $this->connection
            ->executeQuery($sql, ['odeSessionId' => $odeSessionId])
            ->fetchAllAssociative();
    }
}
