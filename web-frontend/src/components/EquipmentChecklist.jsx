import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import './EquipmentChecklist.css';

function EquipmentChecklist({ difficulty, duration, tripDays }) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [checkedItems, setCheckedItems] = useState(() => {
    const saved = localStorage.getItem('alpenvia_equipment_checklist');
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
    localStorage.setItem('alpenvia_equipment_checklist', JSON.stringify(checkedItems));
  }, [checkedItems]);

  const toggleItem = (itemKey) => {
    setCheckedItems(prev => ({
      ...prev,
      [itemKey]: !prev[itemKey]
    }));
  };

  const getEquipmentList = () => {
    const isMultiDay = tripDays > 1;
    const isLongHike = duration > 4;
    const isDifficult = difficulty === 'hard';

    const equipment = {
      essentials: [
        { key: 'backpack', name: t('equipment.backpack') },
        { key: 'water', name: t('equipment.water') },
        { key: 'firstAid', name: t('equipment.firstAid') },
        { key: 'sunscreen', name: t('equipment.sunscreen') },
        { key: 'phone', name: t('equipment.phone') },
      ],
      clothing: [
        { key: 'hikingBoots', name: t('equipment.hikingBoots') },
        { key: 'layers', name: t('equipment.layers') },
        { key: 'rainJacket', name: t('equipment.rainJacket') },
        { key: 'hat', name: t('equipment.hat') },
        { key: 'gloves', name: t('equipment.gloves') },
      ],
      navigation: [
        { key: 'map', name: t('equipment.map') },
        { key: 'compass', name: t('equipment.compass') },
        { key: 'gps', name: t('equipment.gps') },
      ],
      safety: [
        { key: 'whistle', name: t('equipment.whistle') },
        { key: 'headlamp', name: t('equipment.headlamp') },
        { key: 'emergencyBlanket', name: t('equipment.emergencyBlanket') },
      ],
      foodWater: [
        { key: 'snacks', name: t('equipment.snacks') },
        { key: 'energyBars', name: t('equipment.energyBars') },
        { key: 'extraWater', name: t('equipment.extraWater') },
      ]
    };

    if (isMultiDay) {
      equipment.essentials.push(
        { key: 'tent', name: t('equipment.tent') },
        { key: 'sleepingBag', name: t('equipment.sleepingBag') },
        { key: 'sleepingPad', name: t('equipment.sleepingPad') }
      );
      equipment.clothing.push(
        { key: 'extraClothes', name: t('equipment.extraClothes') },
        { key: 'campShoes', name: t('equipment.campShoes') }
      );
      equipment.foodWater.push(
        { key: 'cookingGear', name: t('equipment.cookingGear') },
        { key: 'meals', name: t('equipment.meals') },
        { key: 'waterFilter', name: t('equipment.waterFilter') }
      );
    }

    if (isDifficult) {
      equipment.safety.push(
        { key: 'helmet', name: t('equipment.helmet') },
        { key: 'iceAxe', name: t('equipment.iceAxe') },
        { key: 'crampons', name: t('equipment.crampons') }
      );
      equipment.navigation.push(
        { key: 'altimeter', name: t('equipment.altimeter') }
      );
    }

    if (isLongHike) {
      equipment.foodWater.push(
        { key: 'electrolytes', name: t('equipment.electrolytes') }
      );
      equipment.safety.push(
        { key: 'trekingPoles', name: t('equipment.trekingPoles') }
      );
    }

    return equipment;
  };

  const equipment = getEquipmentList();
  const totalItems = Object.values(equipment).reduce((sum, cat) => sum + cat.length, 0);
  const checkedCount = Object.values(checkedItems).filter(Boolean).length;
  const progress = totalItems > 0 ? (checkedCount / totalItems) * 100 : 0;

  return (
    <div className="equipment-checklist-section planner-section">
      <div 
        className="checklist-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h2 className="section-title">
          📋 {t('equipment.title')}
        </h2>
        <div className="checklist-summary">
          <div className="progress-indicator">
            <span>{checkedCount}/{totalItems}</span>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progress}%` }}></div>
            </div>
          </div>
          <button className="expand-btn">
            {isExpanded ? '▼' : '▶'}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="checklist-content">
          <div className="equipment-categories">
            <div className="equipment-category">
              <h3 className="category-title">🎒 {t('equipment.essentials')}</h3>
              <div className="equipment-items">
                {equipment.essentials.map(item => (
                  <label key={item.key} className="equipment-item">
                    <input
                      type="checkbox"
                      checked={checkedItems[item.key] || false}
                      onChange={() => toggleItem(item.key)}
                    />
                    <span className="checkbox-custom"></span>
                    <span className="item-name">{item.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="equipment-category">
              <h3 className="category-title">👕 {t('equipment.clothing')}</h3>
              <div className="equipment-items">
                {equipment.clothing.map(item => (
                  <label key={item.key} className="equipment-item">
                    <input
                      type="checkbox"
                      checked={checkedItems[item.key] || false}
                      onChange={() => toggleItem(item.key)}
                    />
                    <span className="checkbox-custom"></span>
                    <span className="item-name">{item.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="equipment-category">
              <h3 className="category-title">🧭 {t('equipment.navigation')}</h3>
              <div className="equipment-items">
                {equipment.navigation.map(item => (
                  <label key={item.key} className="equipment-item">
                    <input
                      type="checkbox"
                      checked={checkedItems[item.key] || false}
                      onChange={() => toggleItem(item.key)}
                    />
                    <span className="checkbox-custom"></span>
                    <span className="item-name">{item.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="equipment-category">
              <h3 className="category-title">🚨 {t('equipment.safety')}</h3>
              <div className="equipment-items">
                {equipment.safety.map(item => (
                  <label key={item.key} className="equipment-item">
                    <input
                      type="checkbox"
                      checked={checkedItems[item.key] || false}
                      onChange={() => toggleItem(item.key)}
                    />
                    <span className="checkbox-custom"></span>
                    <span className="item-name">{item.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="equipment-category">
              <h3 className="category-title">🍎 {t('equipment.foodWater')}</h3>
              <div className="equipment-items">
                {equipment.foodWater.map(item => (
                  <label key={item.key} className="equipment-item">
                    <input
                      type="checkbox"
                      checked={checkedItems[item.key] || false}
                      onChange={() => toggleItem(item.key)}
                    />
                    <span className="checkbox-custom"></span>
                    <span className="item-name">{item.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EquipmentChecklist;
