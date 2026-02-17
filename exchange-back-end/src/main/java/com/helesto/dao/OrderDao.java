package com.helesto.dao;

import java.util.List;

import javax.enterprise.context.ApplicationScoped;
import javax.persistence.EntityManager;
import javax.persistence.PersistenceContext;
import javax.transaction.Transactional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.helesto.model.OrderEntity;

@ApplicationScoped
public class OrderDao {

    private static final Logger LOG = LoggerFactory.getLogger(OrderDao.class.getName());

    @PersistenceContext
    EntityManager em;

    @Transactional
    public void persistOrder(OrderEntity order) {
        LOG.info("Persisting order: {}", order.getClOrdId());
        em.persist(order);
    }

    @Transactional
    public void updateOrder(OrderEntity order) {
        LOG.info("Updating order: {}", order.getClOrdId());
        em.merge(order);
    }

    public OrderEntity findByClOrdId(String clOrdId) {
        LOG.info("Finding order by ClOrdId: {}", clOrdId);
        return em.createQuery("SELECT o FROM OrderEntity o WHERE o.clOrdId = :clOrdId", OrderEntity.class)
                .setParameter("clOrdId", clOrdId)
                .getResultStream()
                .findFirst()
                .orElse(null);
    }

    public OrderEntity findByOrderRefNumber(String orderRefNumber) {
        LOG.info("Finding order by OrderRefNumber: {}", orderRefNumber);
        return em.createQuery("SELECT o FROM OrderEntity o WHERE o.orderRefNumber = :orderRefNumber", OrderEntity.class)
                .setParameter("orderRefNumber", orderRefNumber)
                .getResultStream()
                .findFirst()
                .orElse(null);
    }

    public List<OrderEntity> findAll() {
        LOG.info("Finding all orders");
        return em.createQuery("SELECT o FROM OrderEntity o ORDER BY o.createdAt DESC", OrderEntity.class)
                .getResultList();
    }

    public List<OrderEntity> findBySymbol(String symbol) {
        LOG.info("Finding orders by symbol: {}", symbol);
        return em.createQuery("SELECT o FROM OrderEntity o WHERE o.symbol = :symbol ORDER BY o.createdAt DESC", OrderEntity.class)
                .setParameter("symbol", symbol)
                .getResultList();
    }

    public List<OrderEntity> findByStatus(String status) {
        LOG.info("Finding orders by status: {}", status);
        return em.createQuery("SELECT o FROM OrderEntity o WHERE o.status = :status ORDER BY o.createdAt DESC", OrderEntity.class)
                .setParameter("status", status)
                .getResultList();
    }

    public List<OrderEntity> findByClientId(String clientId) {
        LOG.info("Finding orders by clientId: {}", clientId);
        return em.createQuery("SELECT o FROM OrderEntity o WHERE o.clientId = :clientId ORDER BY o.createdAt DESC", OrderEntity.class)
                .setParameter("clientId", clientId)
                .getResultList();
    }

    @Transactional
    public void update(OrderEntity order) {
        LOG.info("Updating order: {}", order.getOrderRefNumber());
        em.merge(order);
    }
}
