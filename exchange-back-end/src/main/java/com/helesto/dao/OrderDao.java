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

    public List<OrderEntity> findAll() {
        LOG.info("Finding all orders");
        return em.createQuery("SELECT o FROM OrderEntity o ORDER BY o.createdAt DESC", OrderEntity.class)
                .getResultList();
    }
}
